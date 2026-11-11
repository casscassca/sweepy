export type NotifyActionKind = "done" | "tomorrow" | "later";
export type NotifySource = "webhook" | "ha-event";

export function parseNotifyAction(action: string): { kind: NotifyActionKind; assignmentId: string } | null {
  const rules: Array<{ prefix: string; kind: NotifyActionKind }> = [
    { prefix: "MARK_DONE_", kind: "done" },
    { prefix: "DONE_", kind: "done" },
    { prefix: "DEFER_", kind: "tomorrow" },
    { prefix: "DELAY_", kind: "later" },
    { prefix: "WAIT_", kind: "later" },
    { prefix: "LATER_", kind: "later" },
  ];
  for (const { prefix, kind } of rules) {
    if (action.startsWith(prefix)) return { kind, assignmentId: action.slice(prefix.length) };
  }
  return null;
}

/**
 * Home Assistant emits mobile_app_notification_action for every phone
 * notification, including other automations. Those are not Sweepy taps.
 */
export function ignoreNotifyAction(action: string, source: NotifySource) {
  return source === "ha-event" && parseNotifyAction(action) === null;
}
