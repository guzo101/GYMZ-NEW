export const TIME_RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
] as const;

export function getTimeRangeFilter(range: string): { from: string } {
  const now = new Date();
  const from = new Date(now);
  if (range === "today") from.setHours(0, 0, 0, 0);
  else if (range === "week") from.setDate(from.getDate() - 7);
  else if (range === "month") from.setDate(1);
  else if (range === "year") from.setMonth(0, 1);
  return { from: from.toISOString() };
}

export const CHART_PALETTE = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#4ade80", "#fb923c"];

export function formatDate(d: string): string {
  return new Date(d).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}
