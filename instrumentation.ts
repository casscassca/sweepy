export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startHaEventListener } = await import("./lib/ha-events");
  startHaEventListener();

  if (process.env.NODE_ENV === "production") {
    const { startCron } = await import("./lib/cron");
    startCron();
  }
}
