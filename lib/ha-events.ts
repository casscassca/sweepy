import { haConfig } from "./ha";
import { applyNotifyAction } from "./notify-actions";
import { appendIntegrationLog } from "./integration-log";
import { haEventRuntime, type HaEventRuntime } from "./ha-runtime";
import {
  HA_INITIAL_BACKOFF_MS,
  markHaConfigMissing,
  nextBackoffMs,
  runHaConnectAttempt,
  type CancelTimer,
} from "./ha-event-session";

export function haEventStatus() {
  startHaEventListener();
  const rt = haEventRuntime();
  return {
    listening: rt.listening,
    lastError: rt.lastError,
    lastEventAt: rt.lastEventAt,
    phase: rt.phase,
    started: rt.started,
  };
}

export function startHaEventListener() {
  const rt = haEventRuntime();
  if (rt.loop) return;
  rt.loop = true;
  rt.started = true;
  void runLoop().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    const current = haEventRuntime();
    current.loop = false;
    current.listening = false;
    current.phase = "backoff";
    current.lastError = message;
    void reportListenError();
  });
}

async function runLoop() {
  let backoff = HA_INITIAL_BACKOFF_MS;
  for (;;) {
    const ha = haConfig();
    if (!ha) {
      markHaConfigMissing(haEventRuntime(), backoff);
      await reportListenError();
      await delay(backoff);
      backoff = nextBackoffMs(backoff);
      continue;
    }

    let result: { retryInMs: number; resetBackoff: boolean };
    try {
      result = await runHaConnectAttempt({
        httpUrl: ha.url,
        token: ha.token,
        backoffMs: backoff,
        state: haEventRuntime(),
        openSocket: (url) => new WebSocket(url),
        setTimer,
        onAction: (data) => applyNotifyAction({
          action: String(data.action ?? ""),
          actorId: actorIdFrom(data),
          source: "ha-event",
        }).then(() => undefined),
        onListening: () => {
          haEventRuntime().reportedError = null;
          console.log("[ha-events] listening for notification actions");
        },
        logActionFailure: (message) => {
          console.error("[ha-events] action failed", message);
          void appendIntegrationLog({
            kind: "webhook",
            ok: false,
            summary: "notification action failed",
            detail: message.slice(0, 400),
          });
        },
      });
    } catch (err) {
      const rt = haEventRuntime();
      rt.listening = false;
      rt.phase = "backoff";
      rt.lastError = err instanceof Error ? err.message : String(err);
      result = { retryInMs: backoff, resetBackoff: false };
    }

    await reportListenError();
    await delay(result.retryInMs);
    backoff = result.resetBackoff ? HA_INITIAL_BACKOFF_MS : nextBackoffMs(backoff);
  }
}

function actorIdFrom(data: Record<string, unknown>) {
  const actionData = (data.action_data ?? {}) as Record<string, unknown>;
  if (typeof data.sweepyUserId === "string") return data.sweepyUserId;
  if (typeof actionData.sweepyUserId === "string") return actionData.sweepyUserId;
  return undefined;
}

async function reportListenError() {
  const rt: HaEventRuntime = haEventRuntime();
  const message = rt.lastError;
  if (!message || message === rt.reportedError) return;
  rt.reportedError = message;
  console.warn("[ha-events]", message);
  try {
    await appendIntegrationLog({
      kind: "webhook",
      ok: false,
      summary: "HA button listener is down",
      detail: message,
    });
  } catch (err) {
    console.error("[ha-events] could not write the listener error", err);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setTimer(fn: () => void, ms: number): CancelTimer {
  const id = setTimeout(fn, ms);
  let cancelled = false;
  return {
    cancel() {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(id);
    },
  };
}
