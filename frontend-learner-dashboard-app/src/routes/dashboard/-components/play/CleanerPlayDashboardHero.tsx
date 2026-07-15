import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Fire, Play, VideoCamera } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
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
import heroGreeting from "@/assets/cleaner-play/hero-greeting.webp";

/**
 * CleanerPlayDashboardHero — the "Cleaner Play" skin's hero band.
 *
 * Reuses PlayDashboardHero's data/logic (streak, daily goal, resume thread,
 * imminent session) verbatim; only the visual language differs — warm cream
 * surface, felted-clay mascot, and a brand-driven CTA (bg-primary) instead
 * of the fixed --play-c-success green, per institute theming.
 */
export interface CleanerPlayDashboardHeroProps {
  userName: string | null;
  liveSessions: SessionDetails[] | undefined;
  isLoadingLive: boolean;
  hasAnyProgress: boolean;
  studyLibraryLoaded: boolean;
  onJoinSession: (session: SessionDetails) => void;
}

const DAILY_GOAL_XP = 50;
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

function HeroSkeleton(): JSX.Element {
  return (
    <div className="cp-card rounded-2xl p-4 md:p-6">
      <div className="flex animate-pulse flex-col items-center gap-5 md:flex-row md:gap-8">
        <div className="flex items-center gap-4 self-start md:self-center">
          <div className="h-24 w-24 rounded-full bg-cp-bg-deep" />
          <div className="flex flex-col gap-2.5">
            <div className="h-7 w-44 rounded-full bg-cp-bg-deep" />
            <div className="flex gap-2">
              <div className="h-10 w-28 rounded-full bg-cp-bg-deep" />
              <div className="h-10 w-28 rounded-full bg-cp-bg-deep" />
            </div>
          </div>
        </div>
        <div className="h-20 w-full rounded-2xl bg-cp-bg-deep md:flex-1" />
      </div>
    </div>
  );
}

export function CleanerPlayDashboardHero(
  props: CleanerPlayDashboardHeroProps
): JSX.Element {
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

  const period = getGreetingPeriod();
  const firstName = userName?.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName
    ? `Good ${period}, ${firstName}`
    : `Good ${period}`;

  const streak = gamification?.currentStreak ?? 0;
  const todayXp = gamification?.todayXp ?? 0;
  const weeklyDots = gamification?.weeklyDots ?? [];
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayActive = weeklyDots[todayIndex] === true;
  const goalPercent = Math.max(
    todayActive ? 100 : 0,
    Math.min(100, Math.round((todayXp / DAILY_GOAL_XP) * 100))
  );

  const isContinue = resume !== null || hasAnyProgress;
  const ctaLabel = isContinue ? "Continue" : "Start learning";
  const ctaCaption = resume
    ? resume.slideTitle
    : isContinue
      ? "Pick up where you left off"
      : "your first lesson";

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
        <div className="h-11 w-full max-w-md animate-pulse self-start rounded-full bg-cp-bg-deep" />
      ) : (
        imminent && (
          <div className="flex items-center gap-3 rounded-full bg-danger-50 py-2 pl-4 pr-2">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-500/60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-danger-500" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-caption font-semibold uppercase tracking-wide text-danger-600">
                {imminent.isLive
                  ? `${liveClassTerm} live now`
                  : `${liveClassTerm} in ${imminent.minutesToStart} min`}
              </p>
              <p className="cp-heading truncate text-body leading-tight">
                {imminent.session.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onJoinSession(imminent.session)}
              className={cn(
                "h-11 shrink-0 rounded-full bg-white px-5 text-body font-semibold text-danger-600",
                "shadow-sm active:translate-y-0.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-300"
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <VideoCamera weight="fill" size={18} />
                Join
              </span>
            </button>
          </div>
        )
      )}

      {/* Hero band */}
      <div className="cp-card rounded-2xl p-4 md:p-6">
        <div className="flex flex-col items-stretch gap-5 md:flex-row md:items-center md:gap-8">
          {/* Left: mascot + greeting + chips */}
          <div className="flex items-center gap-4">
            <img
              src={heroGreeting}
              alt=""
              aria-hidden="true"
              className="cp-hero-illustration h-24 w-auto shrink-0 sm:h-28"
            />
            <div className="min-w-0">
              <h1 className="cp-heading text-h2">{greeting}</h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {/* Streak flame chip */}
                <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-cp-gold-tint px-3">
                  <Fire
                    weight="fill"
                    size={20}
                    className={streak > 0 ? "text-cp-gold" : "text-cp-muted"}
                  />
                  <span className="cp-heading text-body tabular-nums">
                    {streak}
                  </span>
                  <span className="cp-muted text-caption font-medium">
                    day streak
                  </span>
                </span>
                {/* Daily goal ring chip */}
                <span className="inline-flex h-11 items-center gap-2 rounded-full bg-cp-sage-tint px-3">
                  <ProgressRing
                    value={goalPercent}
                    size={28}
                    strokeWidth={4}
                    color="hsl(var(--primary-500))"
                    bgColor="hsl(var(--cp-sage) / 0.25)"
                    showLabel={false}
                  />
                  <span className="cp-muted text-caption font-medium">
                    Daily goal
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: the one CTA — brand-driven, not a fixed skin color */}
          <div className="flex flex-1 justify-center md:justify-end">
            <button
              type="button"
              onClick={goToCta}
              aria-label={
                resume ? `Continue ${resume.slideTitle}` : `${ctaLabel} learning`
              }
              className={cn(
                "w-full max-w-md rounded-full bg-primary px-8 py-4 text-primary-foreground",
                "shadow-sm transition-transform active:translate-y-0.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              )}
            >
              <span className="flex items-center justify-center gap-3">
                <Play weight="fill" size={24} className="shrink-0" />
                <span className="flex min-w-0 flex-col items-start gap-1">
                  <span className="text-h3 font-bold leading-none">
                    {ctaLabel}
                  </span>
                  <span className="max-w-full truncate rounded-full bg-white/20 px-3 py-0.5 text-caption font-medium">
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
