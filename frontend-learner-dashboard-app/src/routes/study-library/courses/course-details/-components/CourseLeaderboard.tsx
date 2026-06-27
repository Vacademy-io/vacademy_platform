import React, { useEffect, useState } from "react";
import { Trophy, Medal, Crown, CaretRight, Copy, ShareNetwork } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BadgeVisual } from "@/routes/dashboard/-components/badge-icons";
import {
  fetchCourseLeaderboard,
  type CourseLeaderboardData,
  type LeaderboardEntry,
} from "@/services/course-leaderboard";
import { getBadgesEnabled } from "@/services/badge-config";

/**
 * Course leaderboard as a trigger + dialog. Ranked by learning activity, names
 * anonymized (initials, own row "You"), showing each learner's badges. Rendered
 * as a full-width "card" trigger (course discussion) or a "compact" icon button
 * (chat header). Standard design tokens (not Play).
 */

const MEDAL_TONE: Record<number, string> = {
  1: "text-warning-500",
  2: "text-neutral-400",
  3: "text-warning-700",
};

function RankCell({ rank }: { rank: number | null }) {
  if (rank != null && rank >= 1 && rank <= 3) {
    return <Medal weight="fill" className={cn("h-5 w-5", MEDAL_TONE[rank])} />;
  }
  return (
    <span className="w-5 text-center text-caption font-bold text-muted-foreground">
      {rank ?? "–"}
    </span>
  );
}

function BadgeIcons({ entry }: { entry: LeaderboardEntry }) {
  const shown = entry.badges?.slice(0, 3) ?? [];
  if (entry.badgeCount <= 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {shown.map((b, i) => (
        <span key={i} title={b.name} className="inline-flex">
          <BadgeVisual icon={b.icon} size={14} className="text-warning-600" />
        </span>
      ))}
      {entry.badgeCount > shown.length && (
        <span className="text-3xs font-semibold text-warning-600">
          +{entry.badgeCount - shown.length}
        </span>
      )}
    </span>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2",
        entry.currentUser && "bg-primary-50 ring-1 ring-primary-200"
      )}
    >
      <div className="flex w-6 shrink-0 justify-center">
        <RankCell rank={entry.rank} />
      </div>
      <span
        className={cn(
          "flex-1 truncate text-body",
          entry.currentUser
            ? "font-bold text-primary-600"
            : "font-medium text-neutral-700"
        )}
      >
        {entry.name}
      </span>
      <BadgeIcons entry={entry} />
      <span className="w-16 text-right text-caption font-semibold tabular-nums text-neutral-600">
        {entry.points} pts
      </span>
    </div>
  );
}

function YourStanding({ me }: { me: LeaderboardEntry }) {
  return (
    <div className="mb-3 rounded-xl bg-primary-50 p-3 ring-1 ring-primary-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-caption font-semibold uppercase tracking-wide text-primary-600">
            Your standing
          </p>
          <p className="text-h3 font-bold text-primary-600">
            {me.rank != null ? `#${me.rank}` : "Unranked"}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Trophy weight="fill" className="h-4 w-4 text-warning-600" />
            <span className="text-body font-bold text-neutral-700">
              {me.badgeCount}
            </span>
          </div>
          <p className="text-caption text-neutral-500">
            badge{me.badgeCount === 1 ? "" : "s"} earned
          </p>
        </div>
      </div>
      {me.badges?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {me.badges.map((b, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-caption text-neutral-600 ring-1 ring-primary-100"
              title={b.name}
            >
              <BadgeVisual icon={b.icon} size={14} className="text-primary-500" />
              {b.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const CourseLeaderboard: React.FC<{
  packageSessionId: string;
  variant?: "card" | "compact";
}> = ({ packageSessionId, variant = "card" }) => {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CourseLeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // null = unknown yet; gates the whole leaderboard on the badges master toggle.
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getBadgesEnabled().then((e) => {
      if (active) setEnabled(e);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setLoaded(false);
    setData(null);
  }, [packageSessionId]);

  // Card variant shows a rank teaser, so load eagerly; compact loads on open.
  const needData = enabled === true && (variant === "card" || open);
  useEffect(() => {
    if (!needData || loaded || !packageSessionId) return;
    let active = true;
    setLoading(true);
    fetchCourseLeaderboard(packageSessionId).then((d) => {
      if (!active) return;
      setData(d);
      setLoading(false);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [needData, loaded, packageSessionId]);

  // Institute disabled the badges + leaderboard feature → render nothing.
  if (enabled === false) return null;

  const me = data?.currentUser;

  // Public, white-labelled shareable URL (origin IS the institute's white-label host).
  const shareUrl = `${window.location.origin}/leaderboard/${packageSessionId}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Leaderboard link copied");
  };
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: "Course Leaderboard", url: shareUrl }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  const trigger =
    variant === "compact" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Course leaderboard"
        title="Leaderboard"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-500 transition-colors hover:bg-primary-100"
      >
        <Crown weight="fill" className="h-5 w-5" />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-card p-3 text-left transition-colors hover:bg-neutral-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50">
          <Crown weight="fill" className="h-5 w-5 text-warning-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-neutral-700">Leaderboard</p>
          <p className="truncate text-caption text-muted-foreground">
            {me
              ? `You're ${me.rank != null ? `#${me.rank}` : "unranked"} · ${me.badgeCount} badge${me.badgeCount === 1 ? "" : "s"}`
              : "See how you rank in this course"}
          </p>
        </div>
        <CaretRight className="h-4 w-4 shrink-0 text-neutral-400" />
      </button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-7">
              <DialogTitle className="flex items-center gap-2">
                <Crown weight="fill" className="h-5 w-5 text-warning-500" />
                Course Leaderboard
              </DialogTitle>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy public link"
                  aria-label="Copy public link"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  title="Share"
                  aria-label="Share leaderboard"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-primary-500 transition-colors hover:bg-primary-50"
                >
                  <ShareNetwork className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DialogHeader>

          {loading && !data ? (
            <p className="py-6 text-center text-caption text-muted-foreground">
              Loading leaderboard…
            </p>
          ) : !data || data.entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Trophy weight="fill" className="h-7 w-7 text-neutral-300" />
              <p className="text-caption text-muted-foreground">
                No leaderboard activity yet — start learning to climb the ranks!
              </p>
            </div>
          ) : (
            <div>
              {me && <YourStanding me={me} />}
              <div className="mb-2 flex items-center justify-between">
                <span className="text-caption font-semibold text-neutral-500">
                  Ranking
                </span>
                <span className="text-caption text-muted-foreground">
                  {data.totalLearners} learners
                </span>
              </div>
              <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                {data.entries.map((entry, i) => (
                  <Row key={i} entry={entry} />
                ))}
              </div>
              <p className="mt-3 text-center text-caption text-muted-foreground">
                Ranked by learning activity • climbs as you learn
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
