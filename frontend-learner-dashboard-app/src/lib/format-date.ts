/**
 * Canonical date formatting — ONE style across the app.
 *
 * The audit found six competing date formats on sibling screens (including a
 * broken "check after 03 in the afternoon"). Every user-facing date goes
 * through these helpers; do not hand-roll Intl/toLocaleString in screens.
 *
 *   formatDate(d)        -> "Jun 10"            (adds ", 2025" when not this year)
 *   formatDateTime(d)    -> "Jun 10, 4:14 PM"   (adds year when not this year)
 *   formatTime(d)        -> "4:14 PM"
 *   formatRelative(d)    -> "just now" | "12m ago" | "3h ago" | "yesterday" | "4 days ago" | formatDate
 *   formatCountdown(ms)  -> "2h 32m" | "32m" | "45s"  (for upcoming-deadline chips)
 */

type DateInput = Date | string | number | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input == null) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

export function formatTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  return `${formatDate(d)}, ${formatTime(d)}`;
}

export function formatRelative(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return formatDate(d);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(d);
}

export function formatCountdown(msUntil: number): string {
  if (msUntil <= 0) return "now";
  const totalSecs = Math.floor(msUntil / 1000);
  if (totalSecs < 60) return `${totalSecs}s`;
  const totalMins = Math.floor(totalSecs / 60);
  if (totalMins < 60) return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
