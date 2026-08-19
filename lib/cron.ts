import cron from "node-cron";
import { reshuffleFrom, sendDueReminders, sendNotificationsForTime, sendNudgesForTime } from "./scheduler";
import { format } from "date-fns";

let started = false;

export function startCron() {
  if (started) return;
  started = true;

  // Midnight: re-pick auto chores for the next few weeks so dirtier / important
  // work floats up. Pins, manual moves, and one-offs stay put.
  cron.schedule("0 0 * * *", async () => {
    console.log("[cron] Refreshing auto assignments...");
    const result = await reshuffleFrom(undefined, 21, { keepHeld: true });
    console.log(`[cron] Assigned ${result.assigned} tasks`);
  });

  // Every minute: check if any user's notify time matches now
  cron.schedule("* * * * *", async () => {
    const timeStr = format(new Date(), "HH:mm");
    await sendNotificationsForTime(timeStr);
    await sendNudgesForTime(timeStr);
    await sendDueReminders();
  });

  console.log("[cron] Scheduler started");
}
