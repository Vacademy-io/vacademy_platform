import type { EngagementItemType } from "@/services/engagement";

/**
 * Per-type presentation. Kept in one place so the feed card, the dialog header and
 * the upcoming strip always describe a task the same way.
 */
export interface EngagementVisual {
  label: string;
  icon: string;
  /** Tailwind classes for the icon chip. */
  chip: string;
  /** Accent used for the card's left edge and progress. */
  accent: string;
}

const VISUALS: Record<EngagementItemType, EngagementVisual> = {
  READING_HTML: {
    label: "Read",
    icon: "BookOpen",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    accent: "bg-sky-500",
  },
  VISUAL_NOTE: {
    label: "Visual note",
    icon: "Images",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    accent: "bg-violet-500",
  },
  QUESTION_OF_DAY: {
    label: "Question of the day",
    icon: "Question",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    accent: "bg-amber-500",
  },
  QUIZ: {
    label: "Quiz",
    icon: "ListChecks",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    accent: "bg-emerald-500",
  },
  GAME: {
    label: "Game",
    icon: "GameController",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    accent: "bg-rose-500",
  },
  POLL: {
    label: "Poll",
    icon: "ChartBar",
    chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    accent: "bg-indigo-500",
  },
};

const FALLBACK: EngagementVisual = {
  label: "Task",
  icon: "Sparkle",
  chip: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  accent: "bg-neutral-500",
};

export function visualFor(type: EngagementItemType): EngagementVisual {
  return VISUALS[type] ?? FALLBACK;
}

/**
 * "4h 12m left" / "18m left". Returns null once the deadline has passed, so the
 * caller can drop the countdown rather than render a negative one.
 */
export function timeLeftLabel(closesAt?: string | null, now: number = Date.now()): string | null {
  if (!closesAt) return null;
  const end = new Date(closesAt).getTime();
  if (!Number.isFinite(end)) return null;
  const ms = end - now;
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d left`;
  }
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (totalMinutes > 0) return `${totalMinutes}m left`;
  return "Closing now";
}

/** "Mon 15 Sep" for the locked upcoming strip. */
export function shortDateLabel(isoDate?: string | null): string {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
