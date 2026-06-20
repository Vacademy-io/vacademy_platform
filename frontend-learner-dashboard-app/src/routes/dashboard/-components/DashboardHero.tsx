/**
 * DashboardHero — the inverted-fold hero band for DEFAULT and VIBRANT modes.
 *
 * Priority order inside the hero:
 *   1. Live/imminent class banner (session live now or starting within 60 min)
 *   2. First-run onboarding (no progress anywhere)
 *   3. Returning learner — point back at courses to pick up where they left off
 *   4. Loading skeleton while the study library hydrates
 *
 * The "Continue learning" resume band lives only on the courses page
 * (study-library/courses HeroSection); the dashboard no longer duplicates it.
 *
 * Play mode gets its own divergent hero elsewhere — this component is only
 * rendered for default/vibrant and must simply not break under .ui-play.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, VideoCamera } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { convertSessionTimeToUserTimezone } from "@/utils/timezone";
import { SessionDetails } from "@/routes/study-library/live-class/-types/types";
import {
  getTerminology,
  getTerminologyPlural,
} from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

export interface DashboardHeroProps {
  userName: string | null;
  /** Upcoming sessions, soonest first (live sessions may be included too). */
  liveSessions: SessionDetails[] | undefined;
  isLoadingLive: boolean;
  /** Any course percentage_completed > 0 — splits first-run from returning. */
  hasAnyProgress: boolean;
  studyLibraryLoaded: boolean;
  onJoinSession: (session: SessionDetails) => void;
}

// ── Timing helpers ───────────────────────────────────────────────────────────

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** A session starting within this window earns the imminent banner. */
const IMMINENT_WINDOW_MS = 60 * MINUTE_MS;

function toSessionDate(
  meetingDate: string,
  time: string,
  timezone?: string,
): Date {
  if (timezone) {
    return convertSessionTimeToUserTimezone(meetingDate, time, timezone);
  }
  return new Date(`${meetingDate}T${time}`);
}

interface BannerSession {
  session: SessionDetails;
  isLive: boolean;
  /** Whole minutes until start; 0 when live. */
  minutesUntilStart: number;
}

/** Pick the banner session: any live session wins, else the soonest one
 *  starting within the imminent window. */
function resolveBannerSession(
  sessions: SessionDetails[] | undefined,
  nowMs: number,
): BannerSession | null {
  if (!sessions || sessions.length === 0) return null;

  let imminent: BannerSession | null = null;
  let imminentStartMs = Number.POSITIVE_INFINITY;

  for (const session of sessions) {
    const start = toSessionDate(
      session.meeting_date,
      session.start_time,
      session.timezone,
    );
    const startMs = start.getTime();
    if (Number.isNaN(startMs)) continue;

    let end = toSessionDate(
      session.meeting_date,
      session.last_entry_time,
      session.timezone,
    );
    let endMs = end.getTime();
    if (Number.isNaN(endMs)) endMs = startMs + HOUR_MS;
    // last_entry_time can roll past midnight relative to start_time.
    if (endMs < startMs) endMs += DAY_MS;

    if (nowMs >= startMs && nowMs <= endMs) {
      return { session, isLive: true, minutesUntilStart: 0 };
    }
    if (
      startMs > nowMs &&
      startMs - nowMs <= IMMINENT_WINDOW_MS &&
      startMs < imminentStartMs
    ) {
      imminentStartMs = startMs;
      imminent = {
        session,
        isLive: false,
        minutesUntilStart: Math.max(
          1,
          Math.ceil((startMs - nowMs) / MINUTE_MS),
        ),
      };
    }
  }

  return imminent;
}

// ── Band shell (shared visual language across all hero states) ──────────────

/** Quiet borderless band on default; tenant-primary wash + 4px top rail on
 *  vibrant (primary tokens only — never fixed pastels). */
const bandClassName = cn(
  "relative w-full overflow-hidden rounded-2xl bg-muted/40 p-5 sm:p-8",
  "[.ui-vibrant_&]:bg-primary-50 dark:[.ui-vibrant_&]:bg-primary-500/10",
  "[.ui-vibrant_&]:border-t-4 [.ui-vibrant_&]:border-t-primary-300",
);

// ── Component ────────────────────────────────────────────────────────────────

export function DashboardHero({
  userName,
  liveSessions,
  isLoadingLive,
  hasAnyProgress,
  studyLibraryLoaded,
  onJoinSession,
}: DashboardHeroProps): JSX.Element | null {
  const navigate = useNavigate();
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Keep "Starts in Xm" current while sessions are on screen.
  useEffect(() => {
    if (!liveSessions || liveSessions.length === 0) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [liveSessions]);

  const banner = useMemo(
    () => (isLoadingLive ? null : resolveBannerSession(liveSessions, nowMs)),
    [liveSessions, isLoadingLive, nowMs],
  );

  const coursesPlural = getTerminologyPlural(
    ContentTerms.Course,
    SystemTerms.Course,
  );
  const liveClassLabel = getTerminology(
    ContentTerms.LiveSession,
    SystemTerms.LiveSession,
  );

  // 4. LOADING — skeleton matching the band's shape.
  if (!studyLibraryLoaded) {
    return (
      <section aria-busy="true" aria-label="Loading" className={bandClassName}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-2 h-9 w-full rounded-md sm:w-40" />
        </div>
      </section>
    );
  }

  const goToCourses = () => navigate({ to: "/study-library/courses" });

  // 1. LIVE/IMMINENT CLASS BANNER — slim row above the main band content.
  const liveBanner = banner ? (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-background/80 px-3 py-2.5",
        "[.ui-vibrant_&]:bg-background/70",
      )}
    >
      {banner.isLive ? (
        <span aria-hidden="true" className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-500 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-danger-500" />
        </span>
      ) : (
        <VideoCamera
          size={16}
          weight="duotone"
          className="shrink-0 text-primary"
        />
      )}
      <p className="min-w-0 flex-1 truncate text-body font-medium text-foreground">
        {banner.session.title || liveClassLabel}
      </p>
      <span
        className={cn(
          "whitespace-nowrap text-caption",
          banner.isLive
            ? "font-semibold text-danger-600"
            : "text-muted-foreground",
        )}
      >
        {banner.isLive ? "Live now" : `Starts in ${banner.minutesUntilStart}m`}
      </span>
      <Button
        size="sm"
        onClick={() => onJoinSession(banner.session)}
        aria-label={`Join ${banner.session.title || liveClassLabel}`}
        className="gap-1.5"
      >
        <VideoCamera size={14} weight="fill" />
        Join
      </Button>
    </div>
  ) : null;

  // 2. FIRST-RUN — no progress anywhere.
  if (!hasAnyProgress) {
    return (
      <section className={bandClassName}>
        {liveBanner}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              {userName ? `Welcome, ${userName}` : "Welcome"}
            </p>
            <h2 className="text-display-sm text-foreground">
              Start your first lesson
            </h2>
            <p className="text-body text-muted-foreground">
              Browse your {coursesPlural.toLocaleLowerCase()} and begin learning
              at your own pace.
            </p>
          </div>
          <Button
            onClick={goToCourses}
            className="w-full gap-2 sm:w-auto md:shrink-0"
          >
            <BookOpen size={16} weight="fill" />
            Browse {coursesPlural}
          </Button>
        </div>
      </section>
    );
  }

  // 3. RETURNING LEARNER — has progress; the "Continue learning" resume band
  // now lives only on the courses page, so the dashboard hero stays empty here
  // (just surface a live/imminent class if there is one).
  return banner ? <section className={bandClassName}>{liveBanner}</section> : null;

  // Kept for reference — the old "Jump back in" returning-learner band.
  // return (
  //   <section className={bandClassName}>
  //     {liveBanner}
  //     <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
  //       <div className="min-w-0 flex-1 space-y-1.5">
  //         <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
  //           {userName ? `Welcome back, ${userName}` : "Welcome back"}
  //         </p>
  //         <h2 className="text-display-sm text-foreground">Jump back in</h2>
  //         <p className="text-body text-muted-foreground">
  //           Open your {coursesPlural.toLocaleLowerCase()} to pick up where you
  //           left off.
  //         </p>
  //       </div>
  //       <Button
  //         onClick={goToCourses}
  //         className="w-full gap-2 sm:w-auto md:shrink-0"
  //       >
  //         <BookOpen size={16} weight="fill" />
  //         Browse {coursesPlural}
  //       </Button>
  //     </div>
  //   </section>
  // );
}
