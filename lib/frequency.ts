export const FREQ_UNITS = [
  { value: "day", label: "days", singular: "day", days: 1 },
  { value: "week", label: "weeks", singular: "week", days: 7 },
  { value: "month", label: "months", singular: "month", days: 30 },
  { value: "year", label: "years", singular: "year", days: 365 },
] as const;

export type FreqUnit = (typeof FREQ_UNITS)[number]["value"];

export function daysForFrequency(count: number, unit: FreqUnit) {
  const days = FREQ_UNITS.find((u) => u.value === unit)?.days ?? 1;
  return Math.max(1, Math.round(Number(count) || 1) * days);
}

export function splitFrequency(frequencyDays: number): { count: number; unit: FreqUnit } {
  const days = Math.max(1, Math.round(Number(frequencyDays) || 7));
  if (days % 365 === 0) return { count: days / 365, unit: "year" };
  if (days % 30 === 0) return { count: days / 30, unit: "month" };
  if (days % 7 === 0) return { count: days / 7, unit: "week" };
  return { count: days, unit: "day" };
}

export function formatFrequency(frequencyDays: number) {
  const { count, unit } = splitFrequency(frequencyDays);
  const meta = FREQ_UNITS.find((u) => u.value === unit)!;
  if (unit === "day" && count === 1) return "Daily";
  if (count === 1) {
    if (unit === "week") return "Weekly";
    if (unit === "month") return "Monthly";
    if (unit === "year") return "Yearly";
  }
  return `Every ${count} ${count === 1 ? meta.singular : meta.label}`;
}
