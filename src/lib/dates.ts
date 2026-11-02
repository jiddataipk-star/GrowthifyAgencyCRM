/**
 * Business dates are plain "YYYY-MM-DD" strings in Asia/Karachi (UTC+5, no DST).
 * Servers run in UTC, so "today" must always be computed for Pakistan explicitly.
 * Formatting uses fixed locale + time zone so server and browser render identically.
 */
export const BUSINESS_TZ = "Asia/Karachi";

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Pakistan as YYYY-MM-DD. */
export function todayPK(now: Date = new Date()): string {
  return isoFormatter.format(now);
}

/** Parse YYYY-MM-DD as a UTC date (safe for calendar arithmetic). */
export function parseISODate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = parseISODate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

/** Add months keeping the anchor day, clamped to the month's last day. */
export function addBillingMonths(value: string, months: number, anchorDay: number): string {
  const date = parseISODate(value);
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(anchorDay, lastDay));
  return toISODate(first);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

export function monthStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

export function monthEnd(value: string): string {
  const date = parseISODate(monthStart(value));
  return toISODate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

/** Pakistan's fiscal year runs July → June. */
export function fiscalYearStart(value: string): string {
  const date = parseISODate(value);
  const year = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${year}-07-01`;
}

const dayMonthYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: BUSINESS_TZ,
});

/** "1 Nov 2026" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return dayMonthYear.format(parseISODate(value));
}

/** "1 Nov" */
export function formatDayMonth(value: string | null | undefined): string {
  if (!value) return "—";
  return dayMonth.format(parseISODate(value));
}

/** "Nov" */
export function formatMonthShort(value: string): string {
  return monthShort.format(parseISODate(value));
}

/** "November 2026" */
export function formatMonthYear(value: string): string {
  return monthYear.format(parseISODate(value));
}

/** Timestamps (timestamptz) in Pakistan time: "1 Nov 2026, 3:05 pm" */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return dateTime.format(new Date(value));
}

/** Human distance for due dates relative to today: "Today", "in 3 days", "5 days overdue". */
export function dueLabel(due: string, today: string = todayPK()): string {
  const diff = daysBetween(today, due);
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff > 1) return `Due in ${diff} days`;
  if (diff === -1) return "1 day overdue";
  return `${-diff} days overdue`;
}

/** "3 min ago", "2 h ago", "4 Nov" — for sync times and activity. */
export function timeAgo(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return "Never";
  const seconds = Math.round((now.getTime() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDayMonth(todayPK(new Date(value)));
}
