import { connect, type MqttClient } from "mqtt";
import { calendarDayStr } from "./dates";
import {
  buildPublishPlan,
  completedEventPayload,
  idsToRemove,
  parseInventory,
  tombstoneTopics,
  tasksThatMoved,
  type HaMqttAssignment,
  type HaMqttInventory,
  type HaMqttTask,
  type HaMqttTopics,
  type MqttMessage,
} from "./ha-mqtt-payload";
import { mqttMissingMessage, mqttSettings } from "./mqtt-env";
import { prisma } from "./prisma";
import { loadVacationContext } from "./vacation-db";

export type MqttConn = {
  url: string;
  username: string | null;
  password: string | null;
  topics: HaMqttTopics;
};

export function mqttConfig(): MqttConn | null {
  const settings = mqttSettings();
  if (!settings.url) return null;
  return {
    url: settings.url,
    username: settings.username,
    password: settings.password,
    topics: {
      discoveryPrefix: settings.discoveryPrefix,
      base: settings.base,
    },
  };
}

type MqttRuntime = {
  started: boolean;
  client: MqttClient | null;
  connected: boolean;
  lastError: string | null;
  lastSyncAt: string | null;
  syncTimer: ReturnType<typeof setTimeout> | null;
  syncLock: Promise<void>;
  lastInventory: HaMqttInventory;
  inventoryHydrated: boolean;
};

const MQTT_KEY = Symbol.for("sweepy.haMqtt");

function emptyInventory(): HaMqttInventory {
  return { tasks: [], rooms: [], extras: [], homes: {} };
}

/**
 * The standalone server bundles this module twice: once for instrumentation
 * and once for route handlers. A `let client` in the route copy was compiled
 * out (the route never calls start), so publishes from the API did nothing
 * and /api/ha-status always reported configured: false. The broker client
 * lives on globalThis so both copies share it.
 */
function mqttRuntime(): MqttRuntime {
  const g = globalThis as typeof globalThis & { [MQTT_KEY]?: MqttRuntime };
  if (!g[MQTT_KEY]) {
    g[MQTT_KEY] = {
      started: false,
      client: null,
      connected: false,
      lastError: null,
      lastSyncAt: null,
      syncTimer: null,
      syncLock: Promise.resolve(),
      lastInventory: emptyInventory(),
      inventoryHydrated: false,
    };
  }
  return g[MQTT_KEY];
}

export function haMqttStatus() {
  startHaMqtt();
  const settings = mqttSettings();
  const rt = mqttRuntime();
  const configured = Boolean(settings.url);
  return {
    configured,
    connected: configured && rt.connected,
    lastError: configured ? rt.lastError : mqttMissingMessage(),
    lastSyncAt: rt.lastSyncAt,
    url: settings.url,
    missing: settings.missing,
    started: rt.started,
  };
}

export function startHaMqtt() {
  const rt = mqttRuntime();
  if (rt.started) return;
  rt.started = true;
  const cfg = mqttConfig();
  if (!cfg) {
    rt.connected = false;
    rt.lastError = mqttMissingMessage();
    return;
  }
  rt.lastError = null;
  connectBroker(cfg, rt);
}

function connectBroker(cfg: MqttConn, rt: MqttRuntime) {
  const next = connect(cfg.url, {
    reconnectPeriod: 5000,
    protocolVersion: 4,
    username: cfg.username ?? undefined,
    password: cfg.password ?? undefined,
    will: {
      topic: `${cfg.topics.base}/status`,
      payload: "offline",
      retain: true,
      qos: 1,
    },
  });
  rt.client = next;

  next.on("connect", () => {
    rt.connected = true;
    rt.lastError = null;
    console.log(`[ha-mqtt] connected to ${cfg.url}`);
    next.publish(`${cfg.topics.base}/status`, "online", { retain: true, qos: 1 });
    void (async () => {
      if (!rt.inventoryHydrated) {
        rt.lastInventory = await readRetainedInventory(next, cfg);
        rt.inventoryHydrated = true;
      }
      await runInventorySync();
    })();
  });

  next.on("offline", () => {
    rt.connected = false;
  });

  next.on("error", (err) => {
    rt.connected = false;
    rt.lastError = err.message;
    console.warn("[ha-mqtt]", err.message);
  });
}

function readRetainedInventory(sock: MqttClient, cfg: MqttConn) {
  const topic = `${cfg.topics.base}/inventory`;
  return new Promise<HaMqttInventory>((resolve) => {
    const timer = setTimeout(() => {
      sock.removeListener("message", onMessage);
      resolve({ tasks: [], rooms: [], extras: [], homes: {} });
    }, 1500);
    const onMessage = (t: string, payload: Buffer) => {
      if (t !== topic) return;
      clearTimeout(timer);
      sock.removeListener("message", onMessage);
      let raw: unknown = null;
      try {
        raw = JSON.parse(payload.toString());
      } catch {
        raw = null;
      }
      resolve(parseInventory(raw));
    };
    sock.on("message", onMessage);
    sock.subscribe(topic, { qos: 1 });
  });
}

export function scheduleHaMqttSync() {
  startHaMqtt();
  const rt = mqttRuntime();
  if (!mqttConfig()) return;
  if (rt.syncTimer) clearTimeout(rt.syncTimer);
  rt.syncTimer = setTimeout(() => {
    rt.syncTimer = null;
    void runInventorySync();
  }, 800);
}

export async function publishHaMqttTaskEvent(opts: {
  kind: "completed" | "uncompleted";
  taskId: string;
  completedAt: Date;
  userId?: string | null;
  completedById?: string | null;
}) {
  startHaMqtt();
  const cfg = mqttConfig();
  if (!cfg) return;
  const task = await loadTask(opts.taskId);
  if (!task) {
    scheduleHaMqttSync();
    return;
  }
  const [assignedTo, completedBy] = await Promise.all([
    nameFor(opts.userId),
    nameFor(opts.completedById),
  ]);
  if (opts.kind === "completed") {
    await publish({
      topic: `${cfg.topics.base}/task/${task.id}/event`,
      payload: "completed",
      retain: false,
    });
    await publish({
      topic: `${cfg.topics.base}/event/task_completed`,
      payload: JSON.stringify(completedEventPayload({
        task,
        completedAt: opts.completedAt,
        assignedTo,
        completedBy,
      })),
      retain: false,
    });
  }
  scheduleHaMqttSync();
}

async function nameFor(userId: string | null | undefined) {
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return user?.name ?? null;
}

async function runInventorySync() {
  const rt = mqttRuntime();
  const cfg = mqttConfig();
  if (!cfg || !rt.client?.connected) return;
  const previous = rt.syncLock;
  let unlock = () => {};
  rt.syncLock = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  await previous;
  try {
    await publishInventory(cfg);
  } catch (err) {
    rt.lastError = err instanceof Error ? err.message : String(err);
    console.warn("[ha-mqtt] sync failed", rt.lastError);
  } finally {
    unlock();
  }
}

async function publishInventory(cfg: MqttConn) {
  const today = calendarDayStr();
  const [rooms, unassigned, open, vac] = await Promise.all([
    prisma.room.findMany({
      orderBy: { order: "asc" },
      include: {
        tasks: {
          where: { oneOff: false },
          orderBy: { createdAt: "asc" },
          include: { assignableUsers: { include: { user: { select: { name: true } } } } },
        },
      },
    }),
    prisma.task.findMany({
      where: { oneOff: false, roomId: null },
      include: { assignableUsers: { include: { user: { select: { name: true } } } }, room: true },
    }),
    prisma.dailyAssignment.findMany({
      where: { completedAt: null, parked: false, task: { oneOff: false } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
    }),
    loadVacationContext(today),
  ]);

  const assignments: HaMqttAssignment[] = open.map((row) => ({
    taskId: row.taskId,
    date: row.date,
    userId: row.user.id,
    userName: row.user.name,
  }));

  const { messages, inventory } = buildPublishPlan({
    rooms: rooms.map((room) => ({
      id: room.id,
      name: room.name,
      icon: room.icon,
      tasks: room.tasks.map(toHaTask),
    })),
    unassigned: unassigned.map(toHaTask),
    assignments,
    asOf: vac.dirtAsOf,
    today,
    topics: cfg.topics,
  });

  const rt = mqttRuntime();
  const gone = idsToRemove(rt.lastInventory.tasks, inventory.tasks);
  const moved = Object.keys(rt.lastInventory.homes).length === 0
    ? inventory.tasks
    : tasksThatMoved(rt.lastInventory.homes, inventory.homes);
  for (const topic of tombstoneTopics(
    cfg.topics,
    [...new Set([...gone, ...moved])],
    idsToRemove(rt.lastInventory.rooms, inventory.rooms),
    idsToRemove(rt.lastInventory.extras, inventory.extras),
  )) {
    await publish({ topic, payload: "", retain: true });
  }

  for (const message of messages) await publish(message);
  rt.lastInventory = inventory;
  rt.lastSyncAt = new Date().toISOString();
}

function toHaTask(task: {
  id: string;
  name: string;
  difficulty: number;
  frequencyDays: number;
  lastDoneAt: Date | null;
  allowedDays: string | null;
  important: boolean;
  dueOnly: boolean;
  notes: string;
  addonName: string;
  addonFrequencyDays: number;
  addonPoints: number;
  addonLastDoneAt: Date | null;
  addon2Name: string;
  addon2FrequencyDays: number;
  addon2Points: number;
  addon2LastDoneAt: Date | null;
  roomId: string | null;
  room?: { name: string } | null;
  assignableUsers: { user: { name: string } }[];
}): HaMqttTask {
  return {
    id: task.id,
    name: task.name,
    difficulty: task.difficulty,
    frequencyDays: task.frequencyDays,
    lastDoneAt: task.lastDoneAt,
    allowedDays: task.allowedDays,
    important: task.important,
    dueOnly: task.dueOnly,
    notes: task.notes,
    addonName: task.addonName,
    addonFrequencyDays: task.addonFrequencyDays,
    addonPoints: task.addonPoints,
    addonLastDoneAt: task.addonLastDoneAt,
    addon2Name: task.addon2Name,
    addon2FrequencyDays: task.addon2FrequencyDays,
    addon2Points: task.addon2Points,
    addon2LastDoneAt: task.addon2LastDoneAt,
    assignable: task.assignableUsers.map((row) => row.user.name),
    roomId: task.roomId,
    roomName: task.room?.name ?? null,
  };
}

async function loadTask(taskId: string): Promise<HaMqttTask | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      room: true,
      assignableUsers: { include: { user: { select: { name: true } } } },
    },
  });
  if (!task || task.oneOff) return null;
  return toHaTask(task);
}

async function publish(message: MqttMessage) {
  const sock = mqttRuntime().client;
  if (!sock?.connected) return;
  await new Promise<void>((resolve, reject) => {
    sock.publish(message.topic, message.payload, { retain: message.retain, qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
