import { haConfig } from "./ha";
import { applyNotifyAction } from "./notify-actions";
import { appendIntegrationLog } from "./integration-log";

type ListenerStatus = {
  listening: boolean;
  lastError: string | null;
  lastEventAt: string | null;
};

const status: ListenerStatus = { listening: false, lastError: null, lastEventAt: null };
let started = false;
let msgId = 1;

export function haEventStatus() {
  return { ...status };
}

function wsUrl(httpUrl: string) {
  if (httpUrl.startsWith("https://")) return `${httpUrl.replace("https://", "wss://")}/api/websocket`;
  return `${httpUrl.replace("http://", "ws://")}/api/websocket`;
}

export function startHaEventListener() {
  if (started) return;
  started = true;
  void connect(1000);
}

async function connect(backoffMs: number) {
  const ha = haConfig();
  if (!ha) {
    status.listening = false;
    status.lastError = "HA_URL or HA_TOKEN is not set";
    return;
  }

  const url = wsUrl(ha.url);
  let socket: WebSocket;
  try {
    socket = new WebSocket(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    status.listening = false;
    status.lastError = msg;
    scheduleReconnect(backoffMs);
    return;
  }

  socket.addEventListener("message", (ev) => {
    let msg: { type?: string; event?: { event_type?: string; data?: Record<string, unknown> } };
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }

    if (msg.type === "auth_required") {
      socket.send(JSON.stringify({ type: "auth", access_token: ha.token }));
      return;
    }

    if (msg.type === "auth_ok") {
      status.listening = true;
      status.lastError = null;
      socket.send(JSON.stringify({
        id: msgId++,
        type: "subscribe_events",
        event_type: "mobile_app_notification_action",
      }));
      console.log("[ha-events] listening for notification actions");
      return;
    }

    if (msg.type === "auth_invalid") {
      status.listening = false;
      status.lastError = "HA token rejected";
      socket.close();
      return;
    }

    if (msg.type === "event" && msg.event?.event_type === "mobile_app_notification_action") {
      void handleActionEvent(msg.event.data ?? {});
    }
  });

  socket.addEventListener("close", () => {
    status.listening = false;
    scheduleReconnect(backoffMs);
  });

  socket.addEventListener("error", () => {
    status.listening = false;
    status.lastError = `websocket error (${url})`;
    try { socket.close(); } catch { /* already closing */ }
  });
}

function scheduleReconnect(backoffMs: number) {
  const next = Math.min(backoffMs * 2, 30_000);
  setTimeout(() => void connect(next), backoffMs);
}

async function handleActionEvent(data: Record<string, unknown>) {
  status.lastEventAt = new Date().toISOString();
  const action = String(data.action ?? "");
  const actionData = (data.action_data ?? {}) as Record<string, unknown>;
  const actorId = typeof data.sweepyUserId === "string"
    ? data.sweepyUserId
    : typeof actionData.sweepyUserId === "string"
      ? actionData.sweepyUserId
      : undefined;

  if (!action) {
    await appendIntegrationLog({
      kind: "webhook",
      ok: false,
      summary: "HA button tap with no action",
      detail: JSON.stringify(data).slice(0, 400),
    });
    return;
  }

  await applyNotifyAction({ action, actorId, source: "ha-event" });
}
