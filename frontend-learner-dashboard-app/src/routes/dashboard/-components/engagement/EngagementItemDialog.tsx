import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HtmlSlideIframe } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/html-slide-iframe";
import {
  EngagementItem,
  fetchEngagementItem,
  parseQuestionPayload,
  submitEngagementItem,
  type EngagementSubmitResponse,
} from "@/services/engagement";
import DOMPurify from "dompurify";
import { visualFor } from "./engagement-visuals";

/**
 * Client-side mirror of the server's reading gate, so the button explains itself
 * instead of failing on submit. The SERVER is authoritative — it re-checks dwell
 * time and scroll depth and refuses anything that falls short.
 */
const MIN_READ_MS = 15_000;

/**
 * Question prompts and explanations are teacher-authored rich text, so they are
 * sanitized before being injected into the learner app's own DOM.
 *
 * Reading bodies and games take a different route entirely — they render inside the
 * opaque-origin sandboxed iframe, which cannot touch this document at all. Prompts
 * are a line or two of formatted text, so a whole iframe per question would be
 * disproportionate; stripping scripts and event handlers is the right guard here.
 */
function safeHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

/** Render sanitized teacher rich text. */
function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={className}
      // Sanitized directly above; never pass raw teacher HTML here.
      dangerouslySetInnerHTML={{ __html: safeHtml(html) }}
    />
  );
}

/**
 * Opens one daily-engagement task and submits it.
 *
 * Grading, score clamping and point awards all happen server-side — this component
 * reports what the learner did and renders what comes back. It never decides
 * whether an answer was right or how many points it was worth.
 */
export function EngagementItemDialog({
  item,
  open,
  onOpenChange,
  onCompleted,
}: {
  item: EngagementItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (result: EngagementSubmitResponse) => void;
}) {
  const [detail, setDetail] = useState<EngagementItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EngagementSubmitResponse | null>(null);

  // Reading gate inputs: the server decides whether these are sufficient.
  const openedAtRef = useRef<number>(Date.now());
  const scrollPercentRef = useRef<number>(0);
  const gameScoreRef = useRef<number | null>(null);
  /** Sentinel after the content; seeing it means the learner reached the end. */
  const endRef = useRef<HTMLDivElement | null>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [dwellMet, setDwellMet] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedOptionId(null);
    scrollPercentRef.current = 0;
    gameScoreRef.current = null;
    openedAtRef.current = Date.now();
    setReachedEnd(false);
    setDwellMet(false);

    fetchEngagementItem(item.id)
      .then((full) => {
        if (!cancelled) setDetail(full);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e?.response?.data?.message ?? "This task could not be opened right now."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, item]);

  // Dwell timer. Cleared on close so a reopened task starts its clock again.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setDwellMet(true), MIN_READ_MS);
    return () => window.clearTimeout(timer);
  }, [open, item]);

  /**
   * The frame has an opaque origin, so its own scrolling is invisible to us — and it
   * renders at full content height anyway, so the DIALOG is what scrolls. Watching a
   * sentinel placed after the content tells us the learner reached the end without
   * needing to see inside the frame at all.
   */
  useEffect(() => {
    const sentinel = endRef.current;
    if (!open || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          scrollPercentRef.current = 100;
          setReachedEnd(true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, detail, loading]);

  const active = detail ?? item;
  const payload = useMemo(
    () => (active ? parseQuestionPayload(active) : null),
    [active]
  );
  const visual = active ? visualFor(active.itemType) : null;

  const isQuestion = active?.itemType === "QUESTION_OF_DAY" || active?.itemType === "POLL";
  const isHtml =
    active?.itemType === "READING_HTML" ||
    active?.itemType === "VISUAL_NOTE" ||
    active?.itemType === "GAME";

  async function handleSubmit() {
    if (!active) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await submitEngagementItem(active.id, {
        selectedOptionId: selectedOptionId ?? undefined,
        score: gameScoreRef.current ?? undefined,
        timeSpentMs: Date.now() - openedAtRef.current,
        scrollPercent: scrollPercentRef.current,
      });
      setResult(response);
      onCompleted(response);
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not submit this just yet.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const isReading =
    active?.itemType === "READING_HTML" || active?.itemType === "VISUAL_NOTE";
  const readingGateMet = reachedEnd && dwellMet;

  const canSubmit = (() => {
    if (submitting || result) return false;
    if (isQuestion) return Boolean(selectedOptionId);
    if (isReading) return readingGateMet;
    return true;
  })();

  const submitLabel = (() => {
    if (submitting) return "Submitting…";
    if (isQuestion) return "Submit answer";
    if (isReading && !reachedEnd) return "Scroll to the end";
    if (isReading && !dwellMet) return "Keep reading…";
    return "Mark complete";
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen-85 w-full max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-start">
            {visual && (
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${visual.chip}`}>
                {visual.label}
              </span>
            )}
            <span className="truncate">{active?.title}</span>
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="space-y-3 py-6">
            <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-32 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          </div>
        )}

        {!loading && error && !result && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        {!loading && active && (
          <div className="space-y-4">
            {active.pointsPercent != null && active.pointsPercent < 100 && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                You are catching up on this one — it is worth {active.pointsPercent}% of
                its points now.
              </p>
            )}

            {isHtml && active.contentHtml && (
              <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                <HtmlSlideIframe
                  html={active.contentHtml}
                  onProgress={(percent) => {
                    scrollPercentRef.current = Math.max(scrollPercentRef.current, percent);
                  }}
                  onComplete={(slideResult) => {
                    // Self-reported. The server clamps it to the item's max and
                    // refuses to let an unverified score drive the leaderboard.
                    if (typeof slideResult.score === "number") {
                      gameScoreRef.current = slideResult.score;
                    }
                    scrollPercentRef.current = 100;
                  }}
                />
              </div>
            )}

            {isQuestion && (
              <div className="space-y-3">
                {payload?.prompt && (
                  <RichText
                    html={payload.prompt}
                    className="prose prose-sm max-w-none text-base font-medium text-neutral-900 dark:prose-invert dark:text-neutral-100"
                  />
                )}
                <div className="grid gap-2">
                  {(payload?.options ?? []).map((option) => {
                    const isSelected = selectedOptionId === option.id;
                    const isCorrectOption =
                      result?.correctOptionId != null && result.correctOptionId === option.id;
                    const isWrongPick =
                      result != null && isSelected && result.isCorrect === false;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={Boolean(result)}
                        onClick={() => setSelectedOptionId(option.id)}
                        className={[
                          "rounded-lg border px-4 py-3 text-start text-sm transition",
                          isCorrectOption
                            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                            : isWrongPick
                              ? "border-rose-400 bg-rose-50 dark:bg-rose-950/40"
                              : isSelected
                                ? "border-primary-400 bg-primary-50 dark:bg-primary-950/30"
                                : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800",
                        ].join(" ")}
                      >
                        {option.text}
                      </button>
                    );
                  })}
                </div>
                {(payload?.options ?? []).length === 0 && (
                  <p className="text-sm text-neutral-500">
                    This question has no options to show yet.
                  </p>
                )}
              </div>
            )}

            {result && (
              <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {result.isCorrect === true
                    ? "Correct!"
                    : result.isCorrect === false
                      ? "Not this time."
                      : "Done!"}{" "}
                  <span className="font-normal text-neutral-600 dark:text-neutral-400">
                    +{result.pointsAwarded} points
                  </span>
                </p>
                {!result.isRevealed && active.itemType === "QUESTION_OF_DAY" && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    The answer is revealed later today, along with the leaderboard.
                  </p>
                )}
                {result.explanation && (
                  <RichText
                    html={result.explanation}
                    className="prose prose-sm max-w-none text-sm text-neutral-600 dark:prose-invert dark:text-neutral-400"
                  />
                )}
              </div>
            )}

            {/* Sentinel: intersecting means the content was scrolled through. */}
            <div ref={endRef} aria-hidden className="h-px w-full" />

            <div className="flex items-center justify-end gap-2 pt-1">
              {result ? (
                <Button onClick={() => onOpenChange(false)}>Done</Button>
              ) : (
                <Button disabled={!canSubmit} onClick={handleSubmit}>
                  {submitLabel}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
