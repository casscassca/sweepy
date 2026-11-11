async function startBackground(label: string, load: () => Promise<void>) {
  try {
    await load();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[instrumentation] ${label} failed`, err);
    if (label === "HA listener") {
      const { recordHaListenerFailure } = await import("./lib/ha-runtime");
      recordHaListenerFailure(`HA listener failed to start: ${message}`);
    }
  }
}

export async function register() {
  // Edge runs this too. Only skip that runtime — a strict "nodejs" check
  // no-ops when the bundler leaves NEXT_RUNTIME unset, and the listener
  // then never starts and never records an error.
  if (process.env.NEXT_RUNTIME === "edge") return;

  await startBackground("HA listener", async () => {
    const { startHaEventListener } = await import("./lib/ha-events");
    startHaEventListener();
  });

  await startBackground("MQTT", async () => {
    const { startHaMqtt } = await import("./lib/ha-mqtt");
    startHaMqtt();
  });

  if (process.env.NODE_ENV === "production") {
    await startBackground("cron", async () => {
      const { startCron } = await import("./lib/cron");
      startCron();
    });
  }
}
