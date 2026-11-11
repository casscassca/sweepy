import type { HaListenState } from "./ha-runtime";

export const HA_OPEN_TIMEOUT_MS = 15_000;
export const HA_SUBSCRIBE_TIMEOUT_MS = 10_000;
export const HA_PING_INTERVAL_MS = 20_000;
export const HA_PONG_TIMEOUT_MS = 10_000;
export const HA_INITIAL_BACKOFF_MS = 1_000;
export const HA_MAX_BACKOFF_MS = 30_000;
export const HA_CONFIG_MISSING = "HA_URL or HA_TOKEN is not set";

export function nextBackoffMs(current: number) {
  return Math.min(Math.max(current, 1) * 2, HA_MAX_BACKOFF_MS);
}

export function wsUrlForHa(httpUrl: string) {
  const base = httpUrl.replace(/\/$/, "");
  if (base.startsWith("https://")) return `${base.replace("https://", "wss://")}/api/websocket`;
  return `${base.replace("http://", "ws://")}/api/websocket`;
}

export function markHaConfigMissing(state: HaListenState, backoffMs: number) {
  state.listening = false;
  state.phase = "backoff";
  state.lastError = HA_CONFIG_MISSING;
  return { retryInMs: backoffMs, resetBackoff: false as const };
}

export type CancelTimer = { cancel(): void };

export type HaSocketLike = {
  send(data: string): void;
  close(): void;
  addEventListener(
    type: "message" | "close" | "error",
    listener: (ev: { data?: unknown; message?: string; error?: { message?: string } }) => void,
  ): void;
};

type Incoming = {
  id?: number;
  type?: string;
  success?: boolean;
  error?: { message?: string } | string;
  event?: { event_type?: string; data?: Record<string, unknown> };
};

export type ConnectResult = { retryInMs: number; resetBackoff: boolean };

export async function runHaConnectAttempt(opts: {
  httpUrl: string;
  token: string;
  backoffMs: number;
  state: HaListenState;
  openSocket: (url: string) => HaSocketLike;
  setTimer: (fn: () => void, ms: number) => CancelTimer;
  onAction: (data: Record<string, unknown>) => Promise<void>;
  onListening: () => void;
  logActionFailure: (message: string) => void;
}): Promise<ConnectResult> {
  const { state } = opts;
  state.listening = false;
  state.phase = "connecting";

  const url = wsUrlForHa(opts.httpUrl);
  let socket: HaSocketLike;
  try {
    socket = opts.openSocket(url);
  } catch (err) {
    state.phase = "backoff";
    state.lastError = err instanceof Error ? err.message : String(err);
    return { retryInMs: opts.backoffMs, resetBackoff: false };
  }

  const timers: CancelTimer[] = [];
  const track = (timer: CancelTimer) => {
    timers.push(timer);
    return timer;
  };
  const clearAll = () => {
    for (const timer of timers) timer.cancel();
    timers.length = 0;
  };

  let msgId = 1;
  let subscribeId: number | null = null;
  let pingId: number | null = null;
  let subscribed = false;
  let settled = false;
  let pongGen = 0;
  let heartbeatStarted = false;

  return new Promise((resolve) => {
    const finish = (error: string | null) => {
      if (settled) return;
      settled = true;
      clearAll();
      state.listening = false;
      state.phase = "backoff";
      if (error) state.lastError = error;
      try { socket.close(); } catch { /* already closing */ }
      resolve({
        retryInMs: subscribed ? HA_INITIAL_BACKOFF_MS : opts.backoffMs,
        resetBackoff: subscribed,
      });
    };

    const openTimer = track(opts.setTimer(() => {
      finish("HA websocket timed out waiting to authenticate");
    }, HA_OPEN_TIMEOUT_MS));

    const clearPong = () => {
      pongGen += 1;
    };

    const armPong = () => {
      const gen = ++pongGen;
      track(opts.setTimer(() => {
        if (settled || gen !== pongGen) return;
        finish("HA websocket heartbeat timed out");
      }, HA_PONG_TIMEOUT_MS));
    };

    const startHeartbeat = () => {
      if (heartbeatStarted) return;
      heartbeatStarted = true;
      const ping = () => {
        if (settled) return;
        pingId = msgId++;
        socket.send(JSON.stringify({ id: pingId, type: "ping" }));
        armPong();
        track(opts.setTimer(ping, HA_PING_INTERVAL_MS));
      };
      track(opts.setTimer(ping, HA_PING_INTERVAL_MS));
    };

    socket.addEventListener("message", (ev) => {
      if (settled) return;
      clearPong();
      let msg: Incoming;
      try {
        msg = JSON.parse(String(ev.data ?? "")) as Incoming;
      } catch {
        return;
      }

      if (msg.type === "auth_required") {
        socket.send(JSON.stringify({ type: "auth", access_token: opts.token }));
        return;
      }

      if (msg.type === "auth_invalid") {
        finish("HA token rejected");
        return;
      }

      if (msg.type === "auth_ok") {
        if (subscribeId !== null) return;
        openTimer.cancel();
        subscribeId = msgId++;
        state.listening = false;
        socket.send(JSON.stringify({
          id: subscribeId,
          type: "subscribe_events",
          event_type: "mobile_app_notification_action",
        }));
        track(opts.setTimer(() => {
          if (subscribed || settled) return;
          finish("HA did not acknowledge the notification action subscription");
        }, HA_SUBSCRIBE_TIMEOUT_MS));
        startHeartbeat();
        return;
      }

      if (msg.type === "pong") return;

      if (msg.type === "result") {
        if (msg.id === pingId && msg.success === false) {
          finish("HA websocket heartbeat failed");
          return;
        }
        if (msg.id !== subscribeId) return;
        if (msg.success === true) {
          subscribed = true;
          state.listening = true;
          state.phase = "listening";
          state.lastError = null;
          opts.onListening();
          return;
        }
        finish(resultError(msg));
        return;
      }

      if (msg.type === "event" && msg.event?.event_type === "mobile_app_notification_action") {
        const data = msg.event.data ?? {};
        state.lastEventAt = new Date().toISOString();
        void Promise.resolve(opts.onAction(data)).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          opts.logActionFailure(message);
        });
      }
    });

    socket.addEventListener("error", (ev) => {
      const message = ev.message || ev.error?.message;
      finish(message ? `websocket error (${url}): ${message}` : `websocket error (${url})`);
    });

    socket.addEventListener("close", () => {
      if (settled) return;
      finish("HA websocket closed");
    });
  });
}

function resultError(msg: Incoming) {
  if (typeof msg.error === "string" && msg.error) return msg.error;
  if (msg.error && typeof msg.error === "object" && msg.error.message) return msg.error.message;
  return "HA rejected the notification action subscription";
}
