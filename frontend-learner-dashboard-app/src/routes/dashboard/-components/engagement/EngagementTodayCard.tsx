import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EngagementItem,
  fetchEngagementFeed,
  type EngagementFeed,
} from "@/services/engagement";
import { EngagementItemDialog } from "./EngagementItemDialog";
import { InlineQuestion } from "./InlineQuestion";
import { glimpseFor } from "./engagement-preview";
import { ProgressRing } from "./ProgressRing";
import { RevealedAnswers } from "./RevealedAnswers";
import {
  isUrgent,
  shortDateLabel,
  staggerDelay,
  timeLeftLabel,
  visualFor,
} from "./engagement-visuals";

/**
 * "Your tasks today" — the daily-engagement queue on the learner home page.
 *
 * Renders nothing when the institute has no plan running, so a dashboard without
 * engagement keeps exactly the layout it has today.
 */
export function EngagementTodayCard() {
  const [feed, setFeed] = useState<EngagementFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<EngagementItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Ticks once a minute so countdowns stay honest without a refetch.
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
    // Refetch rather than patching locally: the server owns completion state, the
    // cap, and what the next task in the queue should be.
    void load();
  }, [load]);

  const done = feed?.completedToday ?? 0;
  const remaining = feed?.items.length ?? 0;
  const total = done + remaining;
  const progressPercent = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = total > 0 && remaining === 0;

  const upcoming = useMemo(() => (feed?.upcoming ?? []).slice(0, 4), [feed]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-4">
          <div className="size-16 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-3 w-24 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="h-20 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
        </div>
      </div>
    );
  }

  // Nothing scheduled and nothing coming — stay out of the way entirely.
  if (
    !feed ||
    (feed.items.length === 0 &&
      feed.upcoming.length === 0 &&
      done === 0 &&
      (feed.revealed?.length ?? 0) === 0)
  ) {
    return null;
  }

  return (
    <>
      <section className="animate-fade-in-up overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-neutral-100 bg-gradient-to-r from-primary-50 via-white to-white px-5 py-4 dark:border-neutral-800 dark:from-primary-950/30 dark:via-neutral-900 dark:to-neutral-900">
          <ProgressRing percent={progressPercent} done={done} total={total} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                {allDone ? "All done for today" : "Your tasks today"}
              </h2>
              {(feed.streakDays ?? 0) > 0 && (
                <span
                  className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                  title="Consecutive days with a task completed"
                >
                  🔥 {feed.streakDays}-day streak
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
              {allDone
                ? (feed.streakDays ?? 0) > 0
                  ? `Come back tomorrow to make it ${(feed.streakDays ?? 0) + 1} days.`
                  : "Come back tomorrow to start a streak."
                : remaining === 1
                  ? "One task left — it takes a minute."
                  : `${remaining} tasks waiting for you.`}
            </p>
          </div>
        </div>

        {/* Task queue */}
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {feed.items.map((item, index) => {
            const visual = visualFor(item.itemType);
            const timeLeft = timeLeftLabel(item.closesAt, now);
            const urgent = isUrgent(item.closesAt, now);
            const maxPoints = item.completionPoints + item.correctPoints;
            const glimpse = glimpseFor(item);
            // Poll and question of the day are answered right here; everything else
            // still opens, because it is a document, a game or a lesson elsewhere.
            const isAnswerable =
              item.itemType === "QUESTION_OF_DAY" || item.itemType === "POLL";
            return (
              <li
                key={item.id}
                className={`animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards ${staggerDelay(index)}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setActiveItem(item);
                    setDialogOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveItem(item);
                      setDialogOpen(true);
                    }
                  }}
                  className={`group flex w-full cursor-pointer items-start gap-4 px-5 py-4 text-start transition-colors duration-200 ${visual.wash}`}
                >
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xl transition-transform duration-200 group-hover:scale-110 ${visual.chip}`}
                    aria-hidden
                  >
                    {visual.glyph}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${visual.chip}`}>
                        {visual.label}
                      </span>
                      {item.isRequired && (
                        <span className="rounded-md bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
                          Required
                        </span>
                      )}
                      {item.state === "CATCH_UP" && (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          Catch up · {item.pointsPercent ?? 50}%
                        </span>
                      )}
                    </span>

                    <span className="mt-1 block truncate text-base font-semibold text-neutral-900 dark:text-neutral-50">
                      {item.title}
                    </span>
                    {item.packageSessionName && (
                      <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {item.packageSessionName}
                      </span>
                    )}

                    {/* A glimpse of the actual content, so the card reads as
                        something to do rather than a link to somewhere else. */}
                    {glimpse && (
                      <span className="mt-1 block text-sm text-neutral-600 dark:text-neutral-400">
                        {glimpse}
                      </span>
                    )}

                    {isAnswerable && (
                      <span className="mt-2 block">
                        <InlineQuestion item={item} onCompleted={handleCompleted} />
                      </span>
                    )}

                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {timeLeft && (
                        <span
                          className={
                            urgent
                              ? "flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400"
                              : "flex items-center gap-1 text-neutral-500 dark:text-neutral-400"
                          }
                        >
                          {urgent && (
                            <span className="inline-block size-1.5 animate-pulse rounded-full bg-rose-500" />
                          )}
                          {timeLeft}
                        </span>
                      )}
                      {(item.completedCount ?? 0) > 0 && (
                        <span className="text-neutral-500 dark:text-neutral-400">
                          🔥 {item.completedCount} already done this
                        </span>
                      )}
                      {maxPoints > 0 && (
                        <span className="rounded-full bg-primary-50 px-2 py-0.5 font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                          +{maxPoints} pts
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="shrink-0 pt-1 text-neutral-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-neutral-500 dark:text-neutral-700">
                    ›
                  </span>
                </div>
              </li>
            );
          })}

          {feed.items.length === 0 && (
            <li className="px-5 py-8 text-center">
              <p className="text-3xl">{done > 0 ? "🎉" : "🌱"}</p>
              <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {done > 0
                  ? "Everything done. Nice work."
                  : "Nothing open right now — check back soon."}
              </p>
            </li>
          )}
        </ul>

        {/* Last night's answers */}
        <RevealedAnswers items={feed.revealed ?? []} />

        {/* Locked future tasks */}
        {upcoming.length > 0 && (
          <div className="border-t border-neutral-100 bg-neutral-50/70 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-950/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
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
                    className="flex items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                  >
                    <span aria-hidden className="opacity-60">
                      {visual.glyph}
                    </span>
                    {shortDateLabel(item.runDate)}
                    <span aria-hidden>🔒</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </section>

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
