import { DashbaordResponse, UserActivityArray } from "@/routes/dashboard/-types/dashboard-data-types";
import { WeeklyAttendanceData } from "@/services/attendance/getWeeklyAttendance";
import {
  BadgesRewardsConfig,
  BadgeDefinitionConfig,
  DEFAULT_BADGE_CONFIG,
  ScoringConfig,
  DEFAULT_SCORING,
} from "@/services/badge-config";
import type { AwardedBadge } from "@/services/awarded-badges";

// ── Types ────────────────────────────────────────────────────────────

export interface PlayBadge {
  id: string;
  name: string;
  description: string;
  icon: string; // Phosphor icon name
  unlocked: boolean;
  unlockedAt: string | null; // ISO date
  /** True when an admin manually awarded this badge (vs. auto-unlocked by a trigger). */
  isAdminAwarded?: boolean;
  /** The admin's reason/note for a manual award. */
  awardReason?: string | null;
}

export interface PlayGamificationData {
  // Streak
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  weeklyDots: boolean[]; // Mon–Sun, true = active

  // XP
  totalXp: number;
  todayXp: number;
  level: number;
  xpToNextLevel: number; // remaining XP to level up

  // Achievements
  badges: PlayBadge[];
  /** Master toggle — false hides every badge surface. Optional/undefined = enabled (back-compat). */
  badgesEnabled?: boolean;
  /** How the total XP/points break down per factor (for the learner-facing explainer). */
  xpBreakdown?: XpBreakdownItem[];
}

/** One line of the points breakdown shown to the learner. */
export interface XpBreakdownItem {
  key: string;
  label: string;
  points: number;
}

// ── Constants ────────────────────────────────────────────────────────

const XP_PER_LEVEL = 500;

// ── Cache ────────────────────────────────────────────────────────────

const CACHE_PREFIX = "PLAY_GAMIFICATION_V1";

function getCacheKey(instituteId: string) {
  return `${CACHE_PREFIX}:${instituteId}`;
}

export function getCachedGamification(
  instituteId: string
): PlayGamificationData | null {
  try {
    const raw = localStorage.getItem(getCacheKey(instituteId));
    if (!raw) return null;
    return JSON.parse(raw) as PlayGamificationData;
  } catch {
    return null;
  }
}

function setCachedGamification(
  instituteId: string,
  data: PlayGamificationData
) {
  try {
    localStorage.setItem(getCacheKey(instituteId), JSON.stringify(data));
  } catch {
    // storage full — ignore
  }
}

// ── Computation ──────────────────────────────────────────────────────

/**
 * Compute streak from activity data (must be sorted by date ascending).
 * A day is "active" if time_spent_by_user_millis > 0.
 */
function computeStreak(activities: UserActivityArray): {
  current: number;
  longest: number;
  lastActive: string | null;
} {
  if (!activities.length) return { current: 0, longest: 0, lastActive: null };

  // Build a Set of active dates (yyyy-MM-dd)
  const activeDates = new Set<string>();
  for (const a of activities) {
    if (a.time_spent_by_user_millis > 0) {
      activeDates.add(a.activity_date.slice(0, 10));
    }
  }

  if (activeDates.size === 0) return { current: 0, longest: 0, lastActive: null };

  const sortedDates = [...activeDates].sort();
  const lastActive = sortedDates[sortedDates.length - 1]!;

  // Walk backwards from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let current = 0;
  const d = new Date(today);
  // Allow today or yesterday as the start
  const todayStr = d.toISOString().slice(0, 10);
  if (!activeDates.has(todayStr)) {
    d.setDate(d.getDate() - 1);
  }

  while (activeDates.has(d.toISOString().slice(0, 10))) {
    current++;
    d.setDate(d.getDate() - 1);
  }

  // Longest streak
  let longest = 0;
  let streak = 0;
  let prev: Date | null = null;
  for (const dateStr of sortedDates) {
    const curr = new Date(dateStr);
    if (prev) {
      const diffDays = Math.round(
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 1) {
        streak++;
      } else {
        streak = 1;
      }
    } else {
      streak = 1;
    }
    longest = Math.max(longest, streak);
    prev = curr;
  }

  return { current, longest, lastActive };
}

/** Inputs the configurable points formula is evaluated against (learner's own data). */
interface XpContext {
  activeDays: number;
  streak: number;
  attendedClasses: number;
  completionPct: number; // 0–100, best course
  assessmentPct: number; // 0–100, best assessment
}

/**
 * Compute total points + a per-factor breakdown using the institute's
 * admin-configured "points per action" scoring.
 */
function computeXp(
  scoring: ScoringConfig,
  ctx: XpContext
): { total: number; breakdown: XpBreakdownItem[] } {
  const items: XpBreakdownItem[] = [
    {
      key: "activity",
      label: "Learning activity",
      points: Math.round(scoring.activityPerDay * ctx.activeDays),
    },
    {
      key: "streak",
      label: "Daily streak",
      points: Math.round(scoring.streakPerDay * ctx.streak),
    },
    {
      key: "live",
      label: "Live classes",
      points: Math.round(scoring.liveClassAttended * ctx.attendedClasses),
    },
    {
      key: "completion",
      label: "Course completion",
      points: Math.round(scoring.courseCompletion * (ctx.completionPct / 100)),
    },
    {
      key: "assessment",
      label: "Assessment score",
      points: Math.round(scoring.assessmentBestScore * (ctx.assessmentPct / 100)),
    },
  ];
  // Only surface factors the institute actually rewards (point weight > 0).
  const breakdown = items.filter((_, idx) => {
    const weights = [
      scoring.activityPerDay,
      scoring.streakPerDay,
      scoring.liveClassAttended,
      scoring.courseCompletion,
      scoring.assessmentBestScore,
    ];
    return weights[idx] > 0;
  });
  const total = breakdown.reduce((sum, i) => sum + i.points, 0);
  return { total, breakdown };
}

/**
 * Compute weekly activity dots from attendance data.
 */
function computeWeeklyDots(
  attendance: WeeklyAttendanceData | null
): boolean[] {
  if (!attendance?.days) return Array(7).fill(false);
  return attendance.days.map(
    (day) => day.status === "PRESENT"
  );
}

/** Inputs an admin-configured badge trigger is evaluated against. */
export interface BadgeEvalContext {
  courses: number;
  slides: number;
  streak: number;
  totalXp: number;
  /** Highest course completion % across the learner's courses (0–100). */
  maxCourseCompletionPct: number;
  /** Highest assessment score % across released attempts, or null if unknown. */
  bestAssessmentScorePct: number | null;
  /** Total live classes attended (lookback window). */
  liveSessionCount: number;
  /** Live classes attended in a row, newest-first (no misses). */
  liveSessionStreak: number;
}

/** Evaluate a single badge definition against the learner's stats. */
function isBadgeUnlocked(badge: BadgeDefinitionConfig, ctx: BadgeEvalContext): boolean {
  const t = badge.threshold;
  switch (badge.trigger) {
    case "course_count":
      return ctx.courses >= t;
    case "slide_count":
      return ctx.slides >= t;
    case "streak":
      return ctx.streak >= t;
    case "xp_total":
      return ctx.totalXp >= t;
    case "course_completion":
      return ctx.maxCourseCompletionPct >= t;
    case "assessment_score":
      return ctx.bestAssessmentScorePct != null && ctx.bestAssessmentScorePct >= t;
    case "live_session_count":
      return ctx.liveSessionCount >= t;
    case "live_session_streak":
      return ctx.liveSessionStreak >= t;
    default:
      return false;
  }
}

/**
 * Check which configured badges are unlocked. Driven by the per-institute admin
 * config (falls back to the default six). Admin-awarded badges are merged in:
 * a manual award forces the badge unlocked (even if its trigger isn't met), and
 * awards for badges no longer in the config are appended from their snapshot.
 */
function computeBadges(
  config: BadgesRewardsConfig,
  ctx: BadgeEvalContext,
  awarded: AwardedBadge[]
): PlayBadge[] {
  const now = new Date().toISOString();
  const awardByBadgeId = new Map<string, AwardedBadge>();
  for (const a of awarded) {
    if (a?.badgeId) awardByBadgeId.set(a.badgeId, a);
  }

  const badges: PlayBadge[] = config.badges.map((def) => {
    const award = awardByBadgeId.get(def.id);
    const unlocked = isBadgeUnlocked(def, ctx) || Boolean(award);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      unlocked,
      unlockedAt: award?.awardedAt ?? (unlocked ? now : null),
      isAdminAwarded: Boolean(award),
      awardReason: award?.reason ?? null,
    };
  });

  // Awarded badges that are no longer in the config (e.g. badge later removed)
  // still belong on the wall — render them from the award's snapshot. Track
  // emitted ids (seeded from config) so a duplicate award row can't double-render.
  const seenIds = new Set(config.badges.map((b) => b.id));
  for (const a of awarded) {
    if (!a?.badgeId || seenIds.has(a.badgeId)) continue;
    seenIds.add(a.badgeId);
    badges.push({
      id: a.badgeId,
      name: a.badgeName || "Badge",
      description: a.badgeDescription || "",
      icon: a.badgeIcon || "Trophy",
      unlocked: true,
      unlockedAt: a.awardedAt ?? now,
      isAdminAwarded: true,
      awardReason: a.reason ?? null,
    });
  }

  return badges;
}

// ── Main Entry Point ─────────────────────────────────────────────────

export function computeGamificationData(params: {
  dashboard: DashbaordResponse | null;
  activities: UserActivityArray;
  attendance: WeeklyAttendanceData | null;
  instituteId: string;
  /** Per-institute badge config; defaults to the original six when omitted. */
  badgeConfig?: BadgesRewardsConfig | null;
  /** Learner's courses with completion %, used for the course_completion trigger. */
  studyLibrary?: Array<{ percentage_completed?: number | null }> | null;
  /** Best assessment score %, used for the assessment_score trigger. */
  bestAssessmentScorePct?: number | null;
  /** Admin-awarded badges (server-persisted) merged over the computed unlocks. */
  awardedBadges?: AwardedBadge[];
  /** Admin-configured points-per-action scoring; defaults applied when omitted. */
  scoring?: ScoringConfig | null;
  /** Total live classes attended (lookback window), for live_session_count. */
  liveSessionCount?: number;
  /** Live classes attended in a row (no misses), for live_session_streak. */
  liveSessionStreak?: number;
}): PlayGamificationData {
  const {
    dashboard,
    activities,
    attendance,
    instituteId,
    badgeConfig,
    studyLibrary,
    bestAssessmentScorePct = null,
    awardedBadges = [],
    scoring,
    liveSessionCount = 0,
    liveSessionStreak = 0,
  } = params;

  const { current: currentStreak, longest: longestStreak, lastActive } =
    computeStreak(activities);

  const attendanceDays = attendance?.days
    ? attendance.days.filter((d) => d.status === "PRESENT").length
    : 0;

  // Distinct days the learner was active (drives the activity points factor).
  const activeDays = new Set(
    activities
      .filter((a) => a.time_spent_by_user_millis > 0)
      .map((a) => a.activity_date.slice(0, 10))
  ).size;

  const maxCourseCompletionPct = (studyLibrary ?? []).reduce(
    (max, c) => Math.max(max, c?.percentage_completed ?? 0),
    0
  );

  const { total: totalXp, breakdown: xpBreakdown } = computeXp(
    scoring ?? DEFAULT_SCORING,
    {
      activeDays,
      streak: currentStreak,
      attendedClasses: attendanceDays,
      completionPct: maxCourseCompletionPct,
      assessmentPct: bestAssessmentScorePct ?? 0,
    }
  );
  const todayXp = 0;

  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpInCurrentLevel = totalXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpInCurrentLevel;

  const weeklyDots = computeWeeklyDots(attendance);

  // Master toggle: when the institute disabled the feature, emit no badges at all.
  const cfg = badgeConfig ?? DEFAULT_BADGE_CONFIG;
  const badgesEnabled = cfg.enabled === true;
  const badges = badgesEnabled
    ? computeBadges(
        cfg,
        {
          courses: dashboard?.courses ?? 0,
          slides: dashboard?.slides?.length ?? 0,
          streak: currentStreak,
          totalXp,
          maxCourseCompletionPct,
          bestAssessmentScorePct,
          liveSessionCount,
          liveSessionStreak,
        },
        awardedBadges
      )
    : [];

  const data: PlayGamificationData = {
    currentStreak,
    longestStreak,
    lastActivityDate: lastActive,
    weeklyDots,
    totalXp,
    todayXp,
    level,
    xpToNextLevel,
    badges,
    badgesEnabled,
    xpBreakdown,
  };

  // Persist to cache
  setCachedGamification(instituteId, data);

  return data;
}
