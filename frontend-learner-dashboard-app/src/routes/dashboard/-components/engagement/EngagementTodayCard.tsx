import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  EngagementItem,
  fetchEngagementFeed,
  type EngagementFeed,
} from "@/services/engagement";
import { EngagementItemDialog } from "./EngagementItemDialog";
import { shortDateLabel, timeLeftLabel, visualFor } from "./engagement-visuals";

/**
 * "Your tasks today" — the daily-engagement queue on the learner home page.
 *
 * Renders nothing at all when the learner's institute has no plan running, so a
 * dashboard without engagement keeps exactly the layout it has today.
 */
export function EngagementTodayCard() {
  const [feed, setFeed] = useState<EngagementFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<EngagementItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Ticks once a minute so the countdowns stay honest without a refetch.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const next = await fetchEngagementFeed();
    setFeed(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleCompleted = useCallback(() => {
    // Refetch rather than patching locally: the server owns completion state,
    // the cap, and what the next task in the queue should be.
    void load();
  }, [load]);

  const done = feed?.completedToday ?? 0;
  const remaining = feed?.items.length ?? 0;
  const total = done + remaining;
  const progressPercent = total === 0 ? 0 : Math.round((done / total) * 100);

  const upcoming = useMemo(() => (feed?.upcoming ?? []).slice(0, 4), [feed]);

  if (loading) {
    return (
      <Card className="p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-4 space-y-3">
          <div className="h-16 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
          <div className="h-16 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
        </div>
      </Card>
    );
  }

  // Nothing scheduled and nothing coming — stay out of the way entirely.
  if (!feed || (feed.items.length === 0 && feed.upcoming.length === 0 && done === 0)) {
    return null;
  }

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Your tasks today
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {total === 0
                ? "Nothing due right now"
                : `${done} of ${total} done`}
            </p>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-3">
              <div className="h-2 w-28 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                {/* Genuinely dynamic: the fill tracks a runtime completion
                    percentage, which no utility class can express. */}
                <div
                  className="h-full rounded-full bg-primary-500 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-sm font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
                {progressPercent}%
              </span>
            </div>
          )}
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {feed.items.map((item) => {
            const visual = visualFor(item.itemType);
            const timeLeft = timeLeftLabel(item.closesAt, now);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveItem(item);
                  setDialogOpen(true);
                }}
                className="flex w-full items-center gap-4 px-5 py-4 text-start transition hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
              >
                <span className={`h-10 w-1.5 shrink-0 rounded-full ${visual.accent}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${visual.chip}`}>
                      {visual.label}
                    </span>
                    {item.isRequired && (
                      <span className="rounded-md bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">
                        Required
                      </span>
                    )}
                    {item.state === "CATCH_UP" && (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Catch up
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                    {[
                      timeLeft,
                      (item.completedCount ?? 0) > 0
                        ? `${item.completedCount} already done this`
                        : null,
                      item.completionPoints + item.correctPoints > 0
                        ? `up to ${item.completionPoints + item.correctPoints} pts`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            );
          })}

          {feed.items.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              {done > 0
                ? "All done for today. Nice streak work."
                : "Nothing open right now — check back soon."}
            </p>
          )}
        </div>

        {upcoming.length > 0 && (
          <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900/40">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Coming up
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {upcoming.map((item) => {
                const visual = visualFor(item.itemType);
                return (
                  // Locked: the server sends no content for these, so there is
                  // nothing to open and nothing to peek at in devtools.
                  <span
                    key={`${item.id}-${item.runDate}`}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                  >
                    <span className={`h-2 w-2 rounded-full ${visual.accent} opacity-60`} />
                    {visual.label}
                    <span className="text-neutral-400">·</span>
                    {shortDateLabel(item.runDate)}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <EngagementItemDialog
        item={activeItem}
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setActiveItem(null);
        }}
        onCompleted={handleCompleted}
      />
    </>
  );
}
