import { DashbaordResponse, UserActivityArray } from "@/routes/dashboard/-types/dashboard-data-types";
import { WeeklyAttendanceData } from "@/services/attendance/getWeeklyAttendance";

// ── Types ────────────────────────────────────────────────────────────

export interface PlayBadge {
  id: string;
  name: string;
  description: string;
  icon: string; // Phosphor icon name
  unlocked: boolean;
  unlockedAt: string | null; // ISO date
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
}

// ── Constants ────────────────────────────────────────────────────────

const XP_PER_LEVEL = 500;

const BADGE_DEFINITIONS: Omit<PlayBadge, "unlocked" | "unlockedAt">[] = [
  {
    id: "first_course",
    name: "First Steps",
    description: "Complete your first course",
    icon: "BookOpen",
  },
  {
    id: "streak_7",
    name: "On Fire",
    description: "Maintain a 7-day streak",
    icon: "Fire",
  },
  {
    id: "streak_30",
    name: "Unstoppable",
    description: "Maintain a 30-day streak",
    icon: "Lightning",
  },
  {
    id: "perfect_score",
    name: "Perfect Score",
    description: "Score 100% on an assessment",
    icon: "Star",
  },
  {
    id: "completionist",
    name: "Completionist",
    description: "Finish a course at 100%",
    icon: "Trophy",
  },
  {
    id: "dedicated_learner",
    name: "Dedicated Learner",
    description: "Earn 1,000 XP total",
    icon: "Medal",
  },
];

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

/**
 * Compute XP from dashboard data.
 * Formula: courses * 100 + slides_viewed * 10 + tests_completed * 50 + attendance_days * 5
 */
function computeXp(
  dashboard: DashbaordResponse | null,
  attendanceDays: number
): { total: number; today: number } {
  if (!dashboard) return { total: 0, today: 0 };

  const coursesXp = (dashboard.courses || 0) * 100;
  const slidesXp = (dashboard.slides?.length || 0) * 10;
  const testsXp = (dashboard.tests_assigned || 0) * 50;
  const attendanceXp = attendanceDays * 5;
  const total = coursesXp + slidesXp + testsXp + attendanceXp;

  // "Today XP" — approximate: just attendance today + recent slide activity
  const today = Math.min(total, 50); // placeholder — will be refined

  return { total, today };
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

/**
 * Check which badges are unlocked.
 */
function computeBadges(
  dashboard: DashbaordResponse | null,
  streak: number,
  totalXp: number
): PlayBadge[] {
  const now = new Date().toISOString();
  const checks: Record<string, boolean> = {
    first_course: (dashboard?.courses || 0) >= 1,
    streak_7: streak >= 7,
    streak_30: streak >= 30,
    perfect_score: false, // would need assessment data — placeholder
    completionist: false, // would need per-course progress — placeholder
    dedicated_learner: totalXp >= 1000,
  };

  return BADGE_DEFINITIONS.map((def) => ({
    ...def,
    unlocked: checks[def.id] ?? false,
    unlockedAt: checks[def.id] ? now : null,
  }));
}

// ── Main Entry Point ─────────────────────────────────────────────────

export function computeGamificationData(params: {
  dashboard: DashbaordResponse | null;
  activities: UserActivityArray;
  attendance: WeeklyAttendanceData | null;
  instituteId: string;
}): PlayGamificationData {
  const { dashboard, activities, attendance, instituteId } = params;

  const { current: currentStreak, longest: longestStreak, lastActive } =
    computeStreak(activities);

  const attendanceDays = attendance?.days
    ? attendance.days.filter((d) => d.status === "PRESENT").length
    : 0;

  const { total: totalXp, today: todayXp } = computeXp(dashboard, attendanceDays);

  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpInCurrentLevel = totalXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpInCurrentLevel;

  const weeklyDots = computeWeeklyDots(attendance);
  const badges = computeBadges(dashboard, currentStreak, totalXp);

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
  };

  // Persist to cache
  setCachedGamification(instituteId, data);

  return data;
}
