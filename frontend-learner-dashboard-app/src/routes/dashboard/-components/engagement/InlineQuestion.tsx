import { useState } from "react";
import DOMPurify from "dompurify";
import { celebrateCompletion } from "@/lib/play-celebration";
import {
  EngagementItem,
  parseQuestionPayload,
  submitEngagementItem,
  type EngagementSubmitResponse,
} from "@/services/engagement";

/**
 * Answer the question of the day straight from the dashboard.
 *
 * The feed already carries the options — with the answer key stripped server-side —
 * so nothing extra is fetched to show them. Making the learner open a dialog just to
 * tap one of four options was friction with no purpose: the point is that it looks
 * answerable the moment they land.
 */
export function InlineQuestion({
  item,
  onCompleted,
}: {
  item: EngagementItem;
  onCompleted: () => void;
}) {
  const payload = parseQuestionPayload(item);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EngagementSubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = payload?.options ?? [];
  if (options.length === 0) return null;

  async function choose(optionId: string) {
    if (submitting || result) return;
    setSelected(optionId);
    setSubmitting(true);
    setError(null);
    try {
      const response = await submitEngagementItem(item.id, {
        selectedOptionId: optionId,
        timeSpentMs: 1,
      });
      setResult(response);
      if (response.pointsAwarded > 0) celebrateCompletion();
      // Let the learner read the outcome before the row disappears from the feed.
      window.setTimeout(onCompleted, 1600);
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not submit that just now.";
      setError(message);
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      {payload?.prompt && (
        <div
          className="prose prose-sm max-w-none text-sm font-medium text-neutral-800 dark:prose-invert dark:text-neutral-100"
          // Teacher rich text, sanitized before it touches the DOM.
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(payload.prompt, { USE_PROFILES: { html: true } }),
          }}
        />
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isPicked = selected === option.id;
          const isCorrect = result?.correctOptionId === option.id;
          const isWrongPick = result != null && isPicked && result.isCorrect === false;
          return (
            <button
              key={option.id}
              type="button"
              disabled={submitting || Boolean(result)}
              onClick={(e) => {
                // The row behind this opens the dialog; keep taps on an option local.
                e.stopPropagation();
                void choose(option.id);
              }}
              className={[
                "flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-start text-sm transition-all duration-200",
                isCorrect
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                  : isWrongPick
                    ? "border-rose-400 bg-rose-50 dark:bg-rose-950/40"
                    : isPicked
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                      : "border-neutral-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-sm dark:border-neutral-800",
              ].join(" ")}
            >
              <span
                className={[
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isCorrect
                    ? "bg-emerald-500 text-white"
                    : isWrongPick
                      ? "bg-rose-500 text-white"
                      : isPicked
                        ? "bg-primary-500 text-white"
                        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
                ].join(" ")}
              >
                {isCorrect ? "✓" : isWrongPick ? "✕" : option.id.toUpperCase()}
              </span>
              <span className="text-neutral-800 dark:text-neutral-100">{option.text}</span>
            </button>
          );
        })}
      </div>

      {result && (
        <p className="animate-in fade-in text-sm font-semibold text-primary-700 dark:text-primary-300">
          {result.isCorrect === true
            ? "Correct!"
            : result.isCorrect === false
              ? "Not this time —"
              : "Answered —"}{" "}
          +{result.pointsAwarded} points
          {!result.isRevealed && result.isCorrect === null
            ? " · the answer drops later today"
            : ""}
        </p>
      )}

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
