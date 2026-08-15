export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCron } = await import("./lib/cron");
    const { startHaEventListener } = await import("./lib/ha-events");
    startCron();
    startHaEventListener();
  }
}
