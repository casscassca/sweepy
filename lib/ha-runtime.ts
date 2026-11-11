export type HaListenPhase = "idle" | "connecting" | "listening" | "backoff";

export type HaListenState = {
  listening: boolean;
  lastError: string | null;
  lastEventAt: string | null;
  phase: HaListenPhase;
};

export type HaEventRuntime = HaListenState & {
  loop: boolean;
  started: boolean;
  reportedError: string | null;
};

const EVENT_KEY = Symbol.for("sweepy.haEvents");

function freshRuntime(): HaEventRuntime {
  return {
    listening: false,
    lastError: null,
    lastEventAt: null,
    phase: "idle",
    loop: false,
    started: false,
    reportedError: null,
  };
}

/**
 * Instrumentation and route handlers are separate bundles in the standalone
 * server. Module-level state in one copy is invisible to the other, and the
 * route copy tree-shakes the socket away. One global slot is the listener
 * both of them see.
 */
export function haEventRuntime(): HaEventRuntime {
  const g = globalThis as typeof globalThis & { [EVENT_KEY]?: HaEventRuntime };
  if (!g[EVENT_KEY]) g[EVENT_KEY] = freshRuntime();
  return g[EVENT_KEY];
}

export function recordHaListenerFailure(message: string) {
  const rt = haEventRuntime();
  rt.listening = false;
  rt.phase = "backoff";
  rt.lastError = message;
  rt.started = true;
  rt.loop = false;
}
