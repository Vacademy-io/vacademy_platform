import React, { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Fire, Play, VideoCamera } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import { playIllustrations } from "@/assets/play-illustrations";
import { ProgressRing } from "./ProgressRing";
import {
  getLatestResume,
  resumeSearchParams,
  RESUME_ROUTE,
} from "@/services/resume-thread";
import { SessionDetails } from "@/routes/study-library/live-class/-types/types";
import {
  isSessionLiveTimezoneAware,
  convertSessionTimeToUserTimezone,
} from "@/utils/timezone";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

export interface PlayDashboardHeroProps {
  userName: string | null;
  liveSessions: SessionDetails[] | undefined;
  isLoadingLive: boolean;
  hasAnyProgress: boolean;
  studyLibraryLoaded: boolean;
  onJoinSession: (session: SessionDetails) => void;
}

/** XP a kid should earn in a day to fill the daily-goal ring. */
const DAILY_GOAL_XP = 50;
/** A session counts as "imminent" when it starts within this many minutes. */
const IMMINENT_WINDOW_MIN = 60;

function getGreetingPeriod(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

interface ImminentSession {
  session: SessionDetails;
  isLive: boolean;
  minutesToStart: number;
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

/** Playful pulsing placeholder shown while the study library loads. */
function HeroSkeleton(): JSX.Element {
  return (
    <div className="rounded-play-card border-2 border-play-surface bg-play-highlight p-4 md:p-6">
      <div className="flex animate-pulse flex-col items-center gap-5 md:flex-row md:gap-8">
        <div className="flex items-center gap-4 self-start md:self-center">
          <div className="h-24 w-24 rounded-full bg-white/70" />
          <div className="flex flex-col gap-2.5">
            <div className="h-7 w-44 rounded-full bg-white/70" />
            <div className="flex gap-2">
              <div className="h-10 w-28 rounded-full bg-white/70" />
              <div className="h-10 w-28 rounded-full bg-white/70" />
            </div>
          </div>
        </div>
        <div className="h-20 w-full rounded-play-card bg-white/70 md:flex-1" />
      </div>
    </div>
  );
}

export function PlayDashboardHero(props: PlayDashboardHeroProps): JSX.Element {
  const {
    userName,
    liveSessions,
    isLoadingLive,
    hasAnyProgress,
    studyLibraryLoaded,
    onJoinSession,
  } = props;

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

  // Greeting
  const period = getGreetingPeriod();
  const firstName = userName?.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName
    ? `Good ${period}, ${firstName}!`
    : `Good ${period}!`;

  // Streak + daily goal
  const streak = gamification?.currentStreak ?? 0;
  const todayXp = gamification?.todayXp ?? 0;
  const weeklyDots = gamification?.weeklyDots ?? [];
  const todayIndex = (new Date().getDay() + 6) % 7; // Monday-first dots
  const todayActive = weeklyDots[todayIndex] === true;
  const goalPercent = Math.max(
    todayActive ? 100 : 0,
    Math.min(100, Math.round((todayXp / DAILY_GOAL_XP) * 100))
  );

  // CTA mode
  const isContinue = resume !== null || hasAnyProgress;
  const ctaLabel = isContinue ? "CONTINUE" : "START";
  const ctaCaption = resume
    ? resume.slideTitle
    : isContinue
      ? "Pick up where you left off"
      : "your first lesson";

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

  if (!studyLibraryLoaded) {
    return <HeroSkeleton />;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Live / imminent class banner */}
      {isLoadingLive ? (
        <div className="h-11 w-full max-w-md animate-pulse self-start rounded-full bg-play-surface" />
      ) : (
        imminent && (
          <div className="flex items-center gap-3 rounded-full bg-play-danger py-2 pl-4 pr-2 shadow-play-2d-danger">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="play-pulse absolute inline-flex h-full w-full rounded-full bg-white/60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-caption font-black uppercase tracking-wide text-white">
                {imminent.isLive
                  ? `${liveClassTerm} live now`
                  : `${liveClassTerm} in ${imminent.minutesToStart} min`}
              </p>
              <p className="truncate text-body font-bold leading-tight text-white">
                {imminent.session.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onJoinSession(imminent.session)}
              className={cn(
                "h-11 shrink-0 rounded-full bg-white px-5 text-body font-black text-play-ink",
                "shadow-play-2d-danger active:translate-y-0.5 active:shadow-none",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <VideoCamera weight="fill" size={18} className="text-play-danger" />
                Join
              </span>
            </button>
          </div>
        )
      )}

      {/* Hero band */}
      <div className="rounded-play-card border-2 border-play-surface bg-play-highlight p-4 md:p-6">
        <div className="flex flex-col items-stretch gap-5 md:flex-row md:items-center md:gap-8">
          {/* Left: mascot + greeting + chips */}
          <div className="flex items-center gap-4">
            <playIllustrations.FeelingHappy
              className="play-float h-24 w-auto shrink-0 text-play-accent sm:h-28"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h1 className="text-h2 font-bold text-play-ink">{greeting}</h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {/* Streak flame chip */}
                <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-3 shadow-play-soft">
                  <Fire
                    weight="fill"
                    size={20}
                    className={streak > 0 ? "text-play-warn" : "text-play-muted"}
                  />
                  <span className="text-body font-black tabular-nums text-play-ink">
                    {streak}
                  </span>
                  <span className="text-caption font-bold text-play-ink">
                    day streak
                  </span>
                </span>
                {/* Daily goal ring chip */}
                <span className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-3 shadow-play-soft">
                  <ProgressRing
                    value={goalPercent}
                    size={30}
                    strokeWidth={5}
                    showLabel={false}
                  />
                  <span className="text-caption font-bold text-play-ink">
                    Daily goal
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: the one giant START / CONTINUE node */}
          <div className="flex flex-1 justify-center md:justify-end">
            <button
              type="button"
              onClick={goToCta}
              aria-label={
                resume ? `Continue ${resume.slideTitle}` : `${ctaLabel} learning`
              }
              className={cn(
                "w-full max-w-md rounded-play-card bg-play-success px-8 py-4",
                "shadow-play-4d-success active:translate-y-0.5 active:shadow-none",
                "transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-play-ink/30"
              )}
            >
              <span className="flex items-center justify-center gap-3">
                <Play weight="fill" size={32} className="shrink-0 text-white" />
                <span className="flex min-w-0 flex-col items-start gap-1">
                  <span className="text-display-sm font-black leading-none text-white">
                    {ctaLabel}
                  </span>
                  <span className="max-w-full truncate rounded-full bg-white px-3 py-0.5 text-caption font-bold text-play-ink">
                    {ctaCaption}
                  </span>
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
