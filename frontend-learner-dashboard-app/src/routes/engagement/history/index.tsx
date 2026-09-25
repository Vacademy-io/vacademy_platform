import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import {
  fetchEngagementHistory,
  parseQuestionPayload,
  type EngagementHistory,
  type EngagementItem,
} from "@/services/engagement";
import { EngagementItemDialog } from "@/routes/dashboard/-components/engagement/EngagementItemDialog";
import { visualFor } from "@/routes/dashboard/-components/engagement/engagement-visuals";

export const Route = createFileRoute("/engagement/history/")({
  component: EngagementHistoryPage,
});

const WINDOWS = [7, 30, 90] as const;

/**
 * Past tasks — what the learner did, missed, or can still catch up on.
 *
 * The home card only ever shows today, so before this page a finished task simply
 * disappeared and a missed one was never acknowledged. Grouped by day, newest
 * first; a catch-up entry opens the same dialog the home card uses, so finishing
 * it late works exactly the same way.
 */
function EngagementHistoryPage() {
  const { t } = useTranslation("dashboardEngagement");
  const navigate = useNavigate();
  const { setNavHeading } = useNavHeadingStore();
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const [data, setData] = useState<EngagementHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeItem, setActiveItem] = useState<EngagementItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setNavHeading(t("history.title"));
  }, [setNavHeading, t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await fetchEngagementHistory(days));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  // Group by run date, newest day first (the server already sorts that way).
  const groups = useMemo(() => {
    const byDate = new Map<string, EngagementItem[]>();
    for (const item of data?.items ?? []) {
      const key = item.runDate ?? "";
      const list = byDate.get(key);
      if (list) list.push(item);
      else byDate.set(key, [item]);
    }
    return Array.from(byDate.entries());
  }, [data]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <LayoutContainer>
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => navigate({ to: "/dashboard" })}
              className="text-sm text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              ‹ {t("history.back")}
            </button>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              {t("history.title")}
            </h1>
            <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
              {t("history.subtitle")}
            </p>
          </div>
          <div className="flex gap-1 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setDays(w)}
                className={
                  days === w
                    ? "rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-50"
                    : "rounded-full px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-400"
                }
              >
                {t("history.window", { count: w })}
              </button>
            ))}
          </div>
        </div>

        {/* Totals */}
        {data && !loading && (
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t("history.done")} value={data.done} tone="good" />
            <Stat label={t("history.missed")} value={data.missed} tone={data.missed > 0 ? "warn" : "neutral"} />
            <Stat label={t("history.points")} value={data.pointsEarned} tone="neutral" />
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-24 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-24 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950/30">
            <p className="text-sm text-rose-700 dark:text-rose-300">{t("history.error")}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-rose-700 shadow-sm dark:bg-neutral-900 dark:text-rose-300"
            >
              {t("history.retry")}
            </button>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-3xl">🌱</p>
            <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t("history.empty")}
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          groups.map(([date, items], groupIndex) => (
            <section
              key={date}
              className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards"
              style={{ animationDelay: `${Math.min(groupIndex, 6) * 60}ms` }}
            >
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {date === today ? t("history.today") : longDateLabel(date)}
              </h2>
              <ul className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                {items.map((item) => (
                  <HistoryRow
                    key={`${item.id}-${item.runDate}`}
                    item={item}
                    onOpen={() => {
                      setActiveItem(item);
                      setDialogOpen(true);
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
      </div>

      <EngagementItemDialog
        item={activeItem}
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setActiveItem(null);
        }}
        onCompleted={() => void load()}
      />
    </LayoutContainer>
  );
}

function HistoryRow({ item, onOpen }: { item: EngagementItem; onOpen: () => void }) {
  const { t } = useTranslation("dashboardEngagement");
  const visual = visualFor(item.itemType);
  const status = item.historyStatus ?? "MISSED";
  const catchable = status === "CATCH_UP";
  const payload = parseQuestionPayload(item);
  const options = payload?.options ?? [];
  const correct = options.find((o) => o.id === item.correctOptionId);
  const mine = options.find((o) => o.id === item.selectedOptionId);

  const badge =
    status === "DONE"
      ? item.isLate
        ? { text: t("history.doneLate"), cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" }
        : { text: t("history.doneBadge"), cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" }
      : catchable
        ? { text: t("history.catchUp", { percent: item.pointsPercent ?? 50 }), cls: "bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200" }
        : { text: t("history.missedBadge"), cls: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300" };

  const outcome =
    status === "DONE" && item.itemType === "QUESTION_OF_DAY"
      ? item.isCorrect === true
        ? t("history.correct")
        : item.isCorrect === false
          ? t("history.wrong")
          : item.resultPending
            ? t("history.pending")
            : null
      : null;

  const inner = (
    <>
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-lg ${visual.chip} ${status === "MISSED" ? "opacity-60 grayscale" : ""}`}
        aria-hidden
      >
        {visual.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{t(`types.${visual.label}`)}</span>
        </span>
        <span
          className={`mt-1 block truncate text-base font-semibold ${status === "MISSED" ? "text-neutral-500 dark:text-neutral-400" : "text-neutral-900 dark:text-neutral-50"}`}
        >
          {item.title}
        </span>
        {item.packageSessionName && (
          <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
            {item.packageSessionName}
          </span>
        )}

        {(outcome || correct || item.explanation) && (
          <span className="mt-2 block space-y-1 text-sm">
            {outcome && (
              <span
                className={
                  item.isCorrect === true
                    ? "block font-medium text-emerald-700 dark:text-emerald-300"
                    : item.isCorrect === false
                      ? "block font-medium text-rose-700 dark:text-rose-300"
                      : "block text-neutral-500 dark:text-neutral-400"
                }
              >
                {outcome}
              </span>
            )}
            {correct && (
              <span className="block text-neutral-700 dark:text-neutral-300">
                <span className="font-semibold">{t("card.answer")}</span> {correct.text}
                {mine && mine.id !== correct.id && (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {" "}
                    · {t("card.youPicked", { text: mine.text })}
                  </span>
                )}
              </span>
            )}
            {item.explanation && (
              <span
                className="prose prose-sm block max-w-none text-neutral-600 dark:prose-invert dark:text-neutral-400"
                // Teacher rich text, sanitized before it touches the DOM.
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(item.explanation, { USE_PROFILES: { html: true } }),
                }}
              />
            )}
          </span>
        )}

        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
          {status === "DONE" && (
            <span className="rounded-full bg-primary-50 px-2 py-0.5 font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
              {t("history.earned", { count: item.pointsAwarded ?? 0 })}
            </span>
          )}
          {status !== "DONE" && (
            <span>{t("card.points", { count: item.completionPoints + item.correctPoints })}</span>
          )}
          {item.completedAt && <span>{timeLabel(item.completedAt)}</span>}
          {catchable && (
            <span className="font-semibold text-primary-700 dark:text-primary-300">
              {t("history.openToCatchUp")}
            </span>
          )}
        </span>
      </span>
      {catchable && (
        <span className="shrink-0 pt-1 text-neutral-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-neutral-500 dark:text-neutral-700">
          ›
        </span>
      )}
    </>
  );

  return (
    <li className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-800">
      {catchable ? (
        <button
          type="button"
          onClick={onOpen}
          className={`group flex w-full items-start gap-4 px-5 py-4 text-start transition-colors duration-200 ${visual.wash}`}
        >
          {inner}
        </button>
      ) : (
        <div className="flex items-start gap-4 px-5 py-4">{inner}</div>
      )}
    </li>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" | "neutral" }) {
  const cls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
        : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${cls}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-50">{value}</p>
    </div>
  );
}

/** "Monday, 15 September" */
function longDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
