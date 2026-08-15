import cron from "node-cron";
import { runDailyAssignment, sendDueReminders, sendNotificationsForTime } from "./scheduler";
import { format } from "date-fns";

let started = false;

export function startCron() {
  if (started) return;
  started = true;

  // Midnight: run daily assignment
  cron.schedule("0 0 * * *", async () => {
    console.log("[cron] Running daily assignment...");
    const result = await runDailyAssignment();
    console.log(`[cron] Assigned ${result.assigned} tasks`);
  });

  // Every minute: check if any user's notify time matches now
  cron.schedule("* * * * *", async () => {
    const timeStr = format(new Date(), "HH:mm");
    await sendNotificationsForTime(timeStr);
    await sendDueReminders();
  });

  console.log("[cron] Scheduler started");
}
