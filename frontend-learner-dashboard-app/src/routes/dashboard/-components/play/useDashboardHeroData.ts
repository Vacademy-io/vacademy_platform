import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import {
  getLatestResume,
  resumeSearchParams,
  RESUME_ROUTE,
  type ResumeEntry,
} from "@/services/resume-thread";
import { SessionDetails } from "@/routes/study-library/live-class/-types/types";
import {
  isSessionLiveTimezoneAware,
  convertSessionTimeToUserTimezone,
} from "@/utils/timezone";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

/**
 * Shared data/derivation layer for the Play and Cleaner Play dashboard
 * heroes. Both skins render the same facts (greeting, streak, daily-goal
 * ring, resume thread, imminent live session, CTA target) with different
 * visual language — this hook is the single source of those facts so the
 * two hero files can't drift apart again (they had already diverged once:
 * reduced-motion guards and a doubled aria-label suffix).
 */

/** XP a learner should earn in a day to fill the daily-goal ring. */
const DAILY_GOAL_XP = 50;
/** A session counts as "imminent" when it starts within this many minutes. */
const IMMINENT_WINDOW_MIN = 60;

export interface ImminentSession {
  session: SessionDetails;
  isLive: boolean;
  minutesToStart: number;
}

function getGreetingPeriod(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** First live session, else the first one starting within the window. */
function findImminentSession(
  sessions: SessionDetails[] | undefined
): ImminentSession | null {
  if (!sessions || sessions.length === 0) return null;

  const live = sessions.find((s) => isSessionLiveTimezoneAware(s));
  if (live) return { session: live, isLive: true, minutesToStart: 0 };

  const now = Date.now();
  let best: ImminentSession | null = null;
  for (const s of sessions) {
    const start = convertSessionTimeToUserTimezone(
      s.meeting_date,
      s.start_time,
      s.timezone
    );
    if (Number.isNaN(start.getTime())) continue;
    const minutes = Math.ceil((start.getTime() - now) / 60000);
    if (minutes < 0 || minutes > IMMINENT_WINDOW_MIN) continue;
    if (!best || minutes < best.minutesToStart) {
      best = { session: s, isLive: false, minutesToStart: minutes };
    }
  }
  return best;
}

export interface DashboardHeroData {
  /** "Good morning, Priya" — no trailing punctuation; skins add their own. */
  greeting: string;
  streak: number;
  goalPercent: number;
  resume: ResumeEntry | null;
  imminent: ImminentSession | null;
  liveClassTerm: string;
  /** Whether the CTA should read as "continue" (vs "start fresh"). */
  isContinue: boolean;
  /** Sub-caption under the CTA label (resume title / generic nudge). */
  ctaCaption: string;
  goToCta: () => void;
}

export function useDashboardHeroData({
  userName,
  liveSessions,
  hasAnyProgress,
}: {
  userName: string | null;
  liveSessions: SessionDetails[] | undefined;
  hasAnyProgress: boolean;
}): DashboardHeroData {
  const navigate = useNavigate();
  const gamification = usePlayGamificationStore((s) => s.data);

  const resume = useMemo(() => getLatestResume(), []);
  const imminent = useMemo(
    () => findImminentSession(liveSessions),
    [liveSessions]
  );

  const liveClassTerm = getTerminology(
    ContentTerms.LiveSession,
    SystemTerms.LiveSession
  );
  const slideTerm = getTerminology(
    ContentTerms.Slides,
    SystemTerms.Slides
  ).toLocaleLowerCase();

  const period = getGreetingPeriod();
  const firstName = userName?.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName
    ? `Good ${period}, ${firstName}`
    : `Good ${period}`;

  const streak = gamification?.currentStreak ?? 0;
  const todayXp = gamification?.todayXp ?? 0;
  const weeklyDots = gamification?.weeklyDots ?? [];
  const todayIndex = (new Date().getDay() + 6) % 7; // Monday-first dots
  const todayActive = weeklyDots[todayIndex] === true;
  const goalPercent = Math.max(
    todayActive ? 100 : 0,
    Math.min(100, Math.round((todayXp / DAILY_GOAL_XP) * 100))
  );

  const isContinue = resume !== null || hasAnyProgress;
  const ctaCaption = resume
    ? resume.slideTitle
    : isContinue
      ? "Pick up where you left off"
      : `your first ${slideTerm}`;

  // Existing app pattern: loosely-typed navigate (the resume route's search
  // schema is validated by the destination route itself).
  const goToCta = () => {
    if (resume) {
      const to: string = RESUME_ROUTE;
      navigate({ to, search: resumeSearchParams(resume) });
    } else {
      navigate({ to: "/study-library/courses" });
    }
  };

  return {
    greeting,
    streak,
    goalPercent,
    resume,
    imminent,
    liveClassTerm,
    isContinue,
    ctaCaption,
    goToCta,
  };
}
