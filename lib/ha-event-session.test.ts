import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HA_CONFIG_MISSING,
  HA_INITIAL_BACKOFF_MS,
  HA_OPEN_TIMEOUT_MS,
  HA_PING_INTERVAL_MS,
  HA_PONG_TIMEOUT_MS,
  HA_SUBSCRIBE_TIMEOUT_MS,
  markHaConfigMissing,
  nextBackoffMs,
  runHaConnectAttempt,
  wsUrlForHa,
  type CancelTimer,
  type HaSocketLike,
} from "./ha-event-session";
import type { HaListenState } from "./ha-runtime";

type FakeTimer = { fn: () => void; ms: number; cancelled: boolean };

function harness(opts?: {
  onAction?: (data: Record<string, unknown>) => Promise<void>;
  openSocket?: () => HaSocketLike;
}) {
  const state: HaListenState = {
    listening: false,
    lastError: null,
    lastEventAt: null,
    phase: "idle",
  };
  const sent: unknown[] = [];
  const failures: string[] = [];
  const timers: FakeTimer[] = [];
  const listeners: Record<string, (ev: { data?: unknown; message?: string }) => void> = {};
  let listeningAnnounced = 0;

  const socket: HaSocketLike = {
    send(data: string) {
      sent.push(JSON.parse(data));
    },
    close() {
      listeners.close?.({});
    },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
  };

  const attempt = runHaConnectAttempt({
    httpUrl: "http://ha.local:8123",
    token: "tok",
    backoffMs: HA_INITIAL_BACKOFF_MS,
    state,
    openSocket: opts?.openSocket ?? (() => socket),
    setTimer(fn, ms): CancelTimer {
      const timer: FakeTimer = { fn, ms, cancelled: false };
      timers.push(timer);
      return { cancel() { timer.cancelled = true; } };
    },
    onAction: opts?.onAction ?? (async () => undefined),
    onListening: () => { listeningAnnounced += 1; },
    logActionFailure: (message) => { failures.push(message); },
  });

  function message(body: unknown) {
    listeners.message?.({ data: JSON.stringify(body) });
  }

  function fire(ms: number) {
    const due = timers.filter((timer) => !timer.cancelled && timer.ms === ms);
    for (const timer of due) {
      timer.cancelled = true;
      timer.fn();
    }
  }

  return { state, sent, failures, attempt, message, fire, listeners, listeningCount: () => listeningAnnounced };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("ha event listener", () => {
  it("builds the websocket url from HA_URL", () => {
    assert.equal(wsUrlForHa("http://host.docker.internal:8123"), "ws://host.docker.internal:8123/api/websocket");
    assert.equal(wsUrlForHa("https://ha.example/"), "wss://ha.example/api/websocket");
  });

  it("keeps retrying when HA_URL or HA_TOKEN is missing and records the error", () => {
    const state: HaListenState = { listening: false, lastError: null, lastEventAt: null, phase: "idle" };
    const first = markHaConfigMissing(state, 1000);
    assert.equal(state.listening, false);
    assert.equal(state.phase, "backoff");
    assert.equal(state.lastError, HA_CONFIG_MISSING);
    assert.equal(first.retryInMs, 1000);
    assert.equal(first.resetBackoff, false);
    assert.equal(nextBackoffMs(1000), 2000);
    assert.equal(nextBackoffMs(20_000), 30_000);
    assert.equal(nextBackoffMs(30_000), 30_000);
  });

  it("is not listening until the subscription result succeeds", async () => {
    const h = harness();
    h.message({ type: "auth_required" });
    assert.deepEqual(h.sent[0], { type: "auth", access_token: "tok" });
    h.message({ type: "auth_ok" });
    assert.equal(h.state.listening, false);
    assert.equal(h.state.lastError, null);
    const subscribe = h.sent[1] as { id: number; type: string; event_type: string };
    assert.equal(subscribe.type, "subscribe_events");
    assert.equal(subscribe.event_type, "mobile_app_notification_action");
    h.message({ id: subscribe.id, type: "result", success: false, error: { message: "not allowed" } });
    const result = await h.attempt;
    assert.equal(h.state.listening, false);
    assert.equal(h.state.lastError, "not allowed");
    assert.equal(result.resetBackoff, false);
    assert.equal(h.listeningCount(), 0);
  });

  it("marks listening only after Home Assistant acknowledges the subscription", async () => {
    const actions: Record<string, unknown>[] = [];
    const h = harness({ onAction: async (data) => { actions.push(data); } });
    h.message({ type: "auth_required" });
    h.message({ type: "auth_ok" });
    const subscribe = h.sent[1] as { id: number };
    h.message({ id: subscribe.id, type: "result", success: true, result: null });
    assert.equal(h.state.listening, true);
    assert.equal(h.state.phase, "listening");
    assert.equal(h.state.lastError, null);
    assert.equal(h.listeningCount(), 1);

    h.message({
      type: "event",
      event: {
        event_type: "mobile_app_notification_action",
        data: { action: "MARK_DONE_abc", action_data: { sweepyUserId: "user-1" } },
      },
    });
    await flush();
    assert.equal(actions.length, 1);
    assert.equal(h.state.listening, true);
    assert.ok(h.state.lastEventAt);

    h.listeners.close?.({});
    const result = await h.attempt;
    assert.equal(h.state.listening, false);
    assert.equal(h.state.lastError, "HA websocket closed");
    assert.equal(result.resetBackoff, true);
    assert.equal(result.retryInMs, HA_INITIAL_BACKOFF_MS);
  });

  it("reconnects when the socket dies quietly", async () => {
    const h = harness();
    h.message({ type: "auth_required" });
    h.message({ type: "auth_ok" });
    const subscribe = h.sent[1] as { id: number };
    h.message({ id: subscribe.id, type: "result", success: true });
    h.fire(HA_PING_INTERVAL_MS);
    const ping = h.sent.at(-1) as { id: number; type: string };
    assert.equal(ping.type, "ping");
    h.fire(HA_PONG_TIMEOUT_MS);
    const result = await h.attempt;
    assert.equal(h.state.listening, false);
    assert.equal(h.state.lastError, "HA websocket heartbeat timed out");
    assert.equal(result.resetBackoff, true);
  });

  it("treats a pong as a live socket", async () => {
    const h = harness();
    h.message({ type: "auth_required" });
    h.message({ type: "auth_ok" });
    const subscribe = h.sent[1] as { id: number };
    h.message({ id: subscribe.id, type: "result", success: true });
    h.fire(HA_PING_INTERVAL_MS);
    const ping = h.sent.at(-1) as { id: number };
    h.message({ id: ping.id, type: "pong" });
    h.fire(HA_PONG_TIMEOUT_MS);
    assert.equal(h.state.listening, true);
    assert.equal(h.state.lastError, null);
    h.listeners.close?.({});
    await h.attempt;
  });

  it("records auth rejection, subscribe silence, and a socket that never authenticates", async () => {
    const rejected = harness();
    rejected.message({ type: "auth_required" });
    rejected.message({ type: "auth_invalid" });
    await rejected.attempt;
    assert.equal(rejected.state.lastError, "HA token rejected");
    assert.equal(rejected.state.listening, false);

    const silent = harness();
    silent.message({ type: "auth_required" });
    silent.message({ type: "auth_ok" });
    silent.fire(HA_SUBSCRIBE_TIMEOUT_MS);
    await silent.attempt;
    assert.equal(silent.state.lastError, "HA did not acknowledge the notification action subscription");

    const stuck = harness();
    stuck.fire(HA_OPEN_TIMEOUT_MS);
    await stuck.attempt;
    assert.equal(stuck.state.lastError, "HA websocket timed out waiting to authenticate");
  });

  it("logs action handler failures and keeps the subscription", async () => {
    const h = harness({
      onAction: async () => { throw new Error("db down"); },
    });
    h.message({ type: "auth_required" });
    h.message({ type: "auth_ok" });
    const subscribe = h.sent[1] as { id: number };
    h.message({ id: subscribe.id, type: "result", success: true });
    h.message({
      type: "event",
      event: { event_type: "mobile_app_notification_action", data: { action: "DONE_1" } },
    });
    await flush();
    assert.deepEqual(h.failures, ["db down"]);
    assert.equal(h.state.listening, true);
    h.listeners.close?.({});
    await h.attempt;
  });

  it("records an error when the socket cannot be opened", async () => {
    const state: HaListenState = { listening: false, lastError: null, lastEventAt: null, phase: "idle" };
    const result = await runHaConnectAttempt({
      httpUrl: "http://ha.local",
      token: "tok",
      backoffMs: 1000,
      state,
      openSocket: () => { throw new Error("ECONNREFUSED"); },
      setTimer: () => ({ cancel() {} }),
      onAction: async () => undefined,
      onListening: () => undefined,
      logActionFailure: () => undefined,
    });
    assert.equal(state.listening, false);
    assert.equal(state.lastError, "ECONNREFUSED");
    assert.equal(result.resetBackoff, false);
    assert.equal(result.retryInMs, 1000);
  });
});
