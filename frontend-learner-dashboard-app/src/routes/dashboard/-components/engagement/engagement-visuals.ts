import type { TFunction } from "i18next";
import {
  BookOpen,
  ChartBar,
  CheckSquare,
  GameController,
  GraduationCap,
  Lightbulb,
  PaintBrush,
  Sparkle,
  type Icon,
} from "@phosphor-icons/react";
import type { EngagementItemType } from "@/services/engagement";

/**
 * Per-type presentation. One place so the feed card, the dialog header and the
 * upcoming strip always describe a task the same way.
 */
export interface EngagementVisual {
  /** i18n key under dashboardEngagement:types. */
  label: string;
  /** Emoji marker — reads instantly and needs no icon import. */
  glyph: string;
  /** Line-icon equivalent of `glyph`, used by the Corporate skin, where emoji
   *  read as consumer/K-12 rather than as a professional work tool. */
  icon: Icon;
  /** Chip background + text. */
  chip: string;
  /** Solid accent for the rail and progress. */
  accent: string;
  /** Soft wash behind the task tile. */
  wash: string;
  /** Gradient for the opened-task header. */
  gradient: string;
}

const VISUALS: Record<EngagementItemType, EngagementVisual> = {
  READING_HTML: {
    label: "READING_HTML",
    glyph: "📖",
    icon: BookOpen,
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
    accent: "bg-sky-500",
    wash: "group-hover:bg-sky-50/60 dark:group-hover:bg-sky-950/20",
    gradient: "from-sky-500 to-cyan-400",
  },
  VISUAL_NOTE: {
    label: "VISUAL_NOTE",
    glyph: "🎨",
    icon: PaintBrush,
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
    accent: "bg-violet-500",
    wash: "group-hover:bg-violet-50/60 dark:group-hover:bg-violet-950/20",
    gradient: "from-violet-500 to-fuchsia-400",
  },
  QUESTION_OF_DAY: {
    label: "QUESTION_OF_DAY",
    glyph: "💡",
    icon: Lightbulb,
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
    accent: "bg-amber-500",
    wash: "group-hover:bg-amber-50/60 dark:group-hover:bg-amber-950/20",
    gradient: "from-amber-500 to-orange-400",
  },
  QUIZ: {
    label: "QUIZ",
    glyph: "✅",
    icon: CheckSquare,
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
    accent: "bg-emerald-500",
    wash: "group-hover:bg-emerald-50/60 dark:group-hover:bg-emerald-950/20",
    gradient: "from-emerald-500 to-teal-400",
  },
  GAME: {
    label: "GAME",
    glyph: "🎮",
    icon: GameController,
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
    accent: "bg-rose-500",
    wash: "group-hover:bg-rose-50/60 dark:group-hover:bg-rose-950/20",
    gradient: "from-rose-500 to-pink-400",
  },
  COURSE_SLIDE: {
    label: "COURSE_SLIDE",
    glyph: "🎓",
    icon: GraduationCap,
    chip: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200",
    accent: "bg-teal-500",
    wash: "group-hover:bg-teal-50/60 dark:group-hover:bg-teal-950/20",
    gradient: "from-teal-500 to-emerald-400",
  },
  POLL: {
    label: "POLL",
    glyph: "📊",
    icon: ChartBar,
    chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200",
    accent: "bg-indigo-500",
    wash: "group-hover:bg-indigo-50/60 dark:group-hover:bg-indigo-950/20",
    gradient: "from-indigo-500 to-blue-400",
  },
};

const FALLBACK: EngagementVisual = {
  label: "fallback",
  glyph: "✨",
  icon: Sparkle,
  chip: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
  accent: "bg-neutral-500",
  wash: "group-hover:bg-neutral-50 dark:group-hover:bg-neutral-900",
  gradient: "from-neutral-500 to-neutral-400",
};

/**
 * Corporate skin: one neutral chip for every task type. The per-type rainbow
 * (sky / violet / amber / emerald / rose / teal / indigo) is a large part of
 * what reads as K-12 on a professional-training dashboard; the type is still
 * named in the chip's text and shown by its line icon.
 */
/**
 * A few catalog strings open with a decorative emoji ("✨ Revealed",
 * "🔒 Answer locked in …") in every locale. Corporate renders them without it
 * rather than forking the copy; the words are unchanged.
 */
export function stripLeadingEmoji(text: string): string {
  return text.replace(/^(?:\p{Extended_Pictographic}\uFE0F?\s*)+/u, "");
}

export const CORPORATE_CHIP =
  "bg-muted text-muted-foreground dark:bg-neutral-800 dark:text-neutral-300";

export function visualFor(type: EngagementItemType): EngagementVisual {
  return VISUALS[type] ?? FALLBACK;
}

/**
 * "4h 12m left" / "18m left". Null once the deadline has passed, so the caller can
 * drop the countdown rather than render a negative one.
 */
export function timeLeftLabel(
  t: TFunction,
  closesAt?: string | null,
  now: number = Date.now()
): string | null {
  if (!closesAt) return null;
  const end = new Date(closesAt).getTime();
  if (!Number.isFinite(end)) return null;
  const ms = end - now;
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) return t("time.daysLeft", { count: Math.floor(hours / 24) });
  if (hours > 0) return t("time.hoursLeft", { hours, minutes });
  if (totalMinutes > 0) return t("time.minutesLeft", { count: totalMinutes });
  return t("time.closingNow");
}

/** True when the deadline is close enough to be worth nudging about. */
export function isUrgent(closesAt?: string | null, now: number = Date.now()): boolean {
  if (!closesAt) return false;
  const end = new Date(closesAt).getTime();
  if (!Number.isFinite(end)) return false;
  const ms = end - now;
  return ms > 0 && ms <= 2 * 60 * 60 * 1000;
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

/** Staggered entrance delay, capped so a long list never feels slow. */
export function staggerDelay(index: number): string {
  const steps = ["delay-0", "delay-75", "delay-150", "delay-200", "delay-300"];
  return steps[Math.min(index, steps.length - 1)]!;
}
