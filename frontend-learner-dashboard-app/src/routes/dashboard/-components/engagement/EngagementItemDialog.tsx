import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HtmlSlideIframe } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/html-slide-iframe";
import { celebrateCompletion } from "@/lib/play-celebration";
import {
  EngagementItem,
  fetchEngagementItem,
  parseQuestionPayload,
  parseSlideTarget,
  questionFormatOf,
  submitEngagementItem,
  type EngagementSubmitResponse,
} from "@/services/engagement";
import { UploadFileInS3 } from "@/services/upload_file";
import { getUserId } from "@/constants/getUserId";
import { Textarea } from "@/components/ui/textarea";
import { visualFor } from "./engagement-visuals";

/**
 * Client-side mirror of the server's reading gate, so the button can explain itself
 * instead of failing on submit. The SERVER is authoritative — it re-checks dwell time
 * and scroll depth and refuses anything short.
 */
const MIN_READ_MS = 15_000;

/** Teacher rich text is sanitized before it touches the learner app's DOM. */
function safeHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={className}
      // Sanitized directly above; never pass raw teacher HTML here.
      dangerouslySetInnerHTML={{ __html: safeHtml(html) }}
    />
  );
}

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
  const { t } = useTranslation("dashboardEngagement");
  const [detail, setDetail] = useState<EngagementItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EngagementSubmitResponse | null>(null);

  const openedAtRef = useRef<number>(Date.now());
  const gameScoreRef = useRef<number | null>(null);
  /** Sentinel after the content; seeing it means the learner reached the end. */
  const endRef = useRef<HTMLDivElement | null>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [dwellMet, setDwellMet] = useState(false);
  const [dwellProgress, setDwellProgress] = useState(0);
  const navigate = useNavigate();
  const [textAnswer, setTextAnswer] = useState("");
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedOptionId(null);
    gameScoreRef.current = null;
    openedAtRef.current = Date.now();
    setReachedEnd(false);
    setDwellMet(false);
    setDwellProgress(0);
    setTextAnswer("");
    setFileIds([]);
    setFileNames([]);

    fetchEngagementItem(item.id)
      .then((full) => {
        if (!cancelled) setDetail(full);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.response?.data?.message ?? t("dialog.openError"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, item, t]);

  // Dwell timer, ticking so the learner can see it fill rather than guess.
  useEffect(() => {
    if (!open) return;
    const started = Date.now();
    const tick = window.setInterval(() => {
      const ratio = Math.min(1, (Date.now() - started) / MIN_READ_MS);
      setDwellProgress(ratio);
      if (ratio >= 1) {
        setDwellMet(true);
        window.clearInterval(tick);
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [open, item]);

  /**
   * The frame has an opaque origin, so its own scrolling is invisible to us — and it
   * renders at full content height anyway, so the DIALOG is what scrolls. Watching a
   * sentinel placed after the content tells us the learner reached the end.
   *
   * threshold MUST stay 0. A sentinel has almost no height, so with a non-zero
   * threshold the observer can compute a ratio of 0 even while the element is on
   * screen and never fire — which left the button stuck on "Scroll to the end".
   */
  useEffect(() => {
    const sentinel = endRef.current;
    if (!open || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setReachedEnd(true);
      },
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, detail, loading]);

  const active = detail ?? item;
  const payload = useMemo(() => (active ? parseQuestionPayload(active) : null), [active]);
  const visual = active ? visualFor(active.itemType) : null;

  const format = active ? questionFormatOf(active) : "MCQ";
  const isQuestionItem =
    active?.itemType === "QUESTION_OF_DAY" || active?.itemType === "POLL";
  // A poll is always a choice; only a question of the day can be written or uploaded.
  const isChoice = isQuestionItem && (active?.itemType === "POLL" || format === "MCQ");
  const isText = active?.itemType === "QUESTION_OF_DAY" && format === "TEXT";
  const isUpload = active?.itemType === "QUESTION_OF_DAY" && format === "UPLOAD";
  const isQuestion = isChoice;
  const isCourseSlide = active?.itemType === "COURSE_SLIDE";
  const slideTarget = useMemo(
    () => (active && isCourseSlide ? parseSlideTarget(active) : null),
    [active, isCourseSlide]
  );
  const isReading = active?.itemType === "READING_HTML" || active?.itemType === "VISUAL_NOTE";
  const isHtml = isReading || active?.itemType === "GAME";
  const readingGateMet = reachedEnd && dwellMet;

  const handleSubmit = useCallback(async () => {
    if (!active) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await submitEngagementItem(active.id, {
        selectedOptionId: selectedOptionId ?? undefined,
        textAnswer: isText ? textAnswer.trim() : undefined,
        fileIds: isUpload && fileIds.length > 0 ? fileIds : undefined,
        score: gameScoreRef.current ?? undefined,
        timeSpentMs: Date.now() - openedAtRef.current,
        // Reaching the sentinel is the scroll signal; the server re-checks it.
        scrollPercent: reachedEnd ? 100 : 0,
      });
      setResult(response);
      if (response.pointsAwarded > 0) celebrateCompletion();
      onCompleted(response);
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("dialog.submitError");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [active, selectedOptionId, reachedEnd, onCompleted, isText, isUpload, textAnswer, fileIds, t]);

  const canSubmit = (() => {
    if (submitting || result) return false;
    if (isChoice) return Boolean(selectedOptionId);
    if (isText) return textAnswer.trim().length > 0;
    if (isUpload) return fileIds.length > 0 && !uploading;
    if (isReading) return readingGateMet;
    return true;
  })();

  const submitLabel = (() => {
    if (submitting) return t("dialog.submitting");
    if (isChoice) return t("dialog.submitAnswer");
    if (isText) return t("dialog.submitAnswer");
    if (isUpload) return uploading ? t("dialog.uploading") : t("dialog.submitAnswer");
    if (isReading && !reachedEnd) return t("dialog.scrollToEnd");
    if (isReading && !dwellMet) return t("dialog.almostThere");
    if (isCourseSlide) return t("dialog.finishedLesson");
    return t("dialog.markComplete");
  })();

  const readingPercent = Math.round(
    ((reachedEnd ? 0.5 : 0) + Math.min(dwellProgress, 1) * 0.5) * 100
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen-85 w-full max-w-3xl overflow-y-auto p-0">
        {/* Type-coloured header */}
        <DialogHeader
          className={`sticky top-0 z-10 space-y-0 bg-gradient-to-r ${visual?.gradient ?? "from-neutral-500 to-neutral-400"} px-5 py-4`}
        >
          <DialogTitle className="flex items-center gap-2 text-start text-white">
            <span aria-hidden className="text-xl">
              {visual?.glyph}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wide text-white/80">
                {visual ? t(`types.${visual.label}`) : ""}
              </span>
              <span className="block truncate text-lg font-bold">{active?.title}</span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5">
          {loading && (
            <div className="space-y-3 py-6">
              <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-40 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
            </div>
          )}

          {!loading && error && !result && (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          )}

          {!loading && active && (
            <div className="space-y-4 pt-4">
              {active.pointsPercent != null && active.pointsPercent < 100 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {t("dialog.catchUpNote", { percent: active.pointsPercent })}
                </p>
              )}

              {isHtml && active.contentHtml && (
                <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <HtmlSlideIframe
                    html={active.contentHtml}
                    onComplete={(slideResult) => {
                      // Self-reported. The server clamps it to the item's max and
                      // caps what an unverified score can do to the leaderboard.
                      if (typeof slideResult.score === "number") {
                        gameScoreRef.current = slideResult.score;
                      }
                      setReachedEnd(true);
                    }}
                  />
                </div>
              )}

              {isCourseSlide && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-center dark:border-teal-900 dark:bg-teal-950/30">
                    <p className="text-3xl">🎓</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                      {slideTarget?.slideTitle ?? active.title}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      {t("dialog.lessonHint")}
                    </p>
                    <Button
                      className="mt-3"
                      disabled={!slideTarget}
                      onClick={() => {
                        if (!slideTarget) return;
                        onOpenChange(false);
                        void navigate({
                          to: "/study-library/courses/course-details/subjects/modules/chapters/slides",
                          search: {
                            courseId: slideTarget.courseId ?? "",
                            levelId: slideTarget.levelId,
                            subjectId: slideTarget.subjectId ?? "",
                            moduleId: slideTarget.moduleId ?? "",
                            chapterId: slideTarget.chapterId ?? "",
                            slideId: slideTarget.slideId,
                            sessionId: slideTarget.sessionId ?? "",
                          },
                        });
                      }}
                    >
                      {t("dialog.openLesson")}
                    </Button>
                  </div>
                  {!slideTarget && (
                    <p className="text-sm text-rose-600 dark:text-rose-400">
                      {t("dialog.lessonBroken")}
                    </p>
                  )}
                </div>
              )}

              {isQuestion && (
                <div className="space-y-3">
                  {payload?.prompt && (
                    <RichText
                      html={payload.prompt}
                      className="prose prose-sm max-w-none text-base font-medium text-neutral-900 dark:prose-invert dark:text-neutral-50"
                    />
                  )}
                  <div className="grid gap-2">
                    {(payload?.options ?? []).map((option, index) => {
                      const isSelected = selectedOptionId === option.id;
                      const isCorrectOption =
                        result?.correctOptionId != null && result.correctOptionId === option.id;
                      const isWrongPick = result != null && isSelected && result.isCorrect === false;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={Boolean(result)}
                          onClick={() => setSelectedOptionId(option.id)}
                          className={[
                            "animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-start text-sm transition-all duration-200",
                            staggerClass(index),
                            isCorrectOption
                              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                              : isWrongPick
                                ? "border-rose-400 bg-rose-50 dark:bg-rose-950/40"
                                : isSelected
                                  ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                                  : "border-neutral-200 hover:border-primary-300 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                              isCorrectOption
                                ? "bg-emerald-500 text-white"
                                : isWrongPick
                                  ? "bg-rose-500 text-white"
                                  : isSelected
                                    ? "bg-primary-500 text-white"
                                    : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
                            ].join(" ")}
                          >
                            {isCorrectOption ? "✓" : isWrongPick ? "✕" : option.id.toUpperCase()}
                          </span>
                          <span className="text-neutral-800 dark:text-neutral-100">
                            {option.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isText && !result && (
                <div className="space-y-2">
                  {payload?.prompt && (
                    <RichText
                      html={payload.prompt}
                      className="prose prose-sm max-w-none text-base font-medium text-neutral-900 dark:prose-invert dark:text-neutral-50"
                    />
                  )}
                  <Textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    rows={6}
                    placeholder={t("dialog.writePlaceholder")}
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t("dialog.writeHint")}
                  </p>
                </div>
              )}

              {isUpload && !result && (
                <div className="space-y-2">
                  {payload?.prompt && (
                    <RichText
                      html={payload.prompt}
                      className="prose prose-sm max-w-none text-base font-medium text-neutral-900 dark:prose-invert dark:text-neutral-50"
                    />
                  )}
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 px-4 py-8 text-center transition hover:border-primary-400 dark:border-neutral-700">
                    <span className="text-2xl">📎</span>
                    <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                      {uploading ? t("dialog.uploading") : t("dialog.chooseFile")}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t("dialog.fileHint")}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const userId = await getUserId();
                          const id = await UploadFileInS3(
                            file,
                            () => {},
                            userId || "",
                            "ENGAGEMENT_ANSWERS",
                            "LEARNER"
                          );
                          if (id) {
                            setFileIds((prev) => [...prev, id]);
                            setFileNames((prev) => [...prev, file.name]);
                          } else {
                            setError(t("dialog.uploadError"));
                          }
                        } catch {
                          setError(t("dialog.uploadError"));
                        } finally {
                          setUploading(false);
                          // Allow re-picking the same file after a failure.
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                  {fileNames.length > 0 && (
                    <ul className="space-y-1">
                      {fileNames.map((name, i) => (
                        <li
                          key={`${name}-${i}`}
                          className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900"
                        >
                          <span className="truncate text-neutral-800 dark:text-neutral-100">
                            📄 {name}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-neutral-500 hover:text-rose-600"
                            onClick={() => {
                              setFileIds((prev) => prev.filter((_, x) => x !== i));
                              setFileNames((prev) => prev.filter((_, x) => x !== i));
                            }}
                          >
                            {t("dialog.remove")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Reading progress — shows the gate instead of hiding it behind a
                  disabled button. */}
              {isReading && !result && (
                <div className="space-y-1.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    {/* Genuinely dynamic: tracks a runtime reading percentage. */}
                    <div
                      className="h-full rounded-full bg-primary-500 transition-all duration-300"
                      style={{ width: `${readingPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {readingGateMet ? t("dialog.readingReady") : t("dialog.readingHint")}
                  </p>
                </div>
              )}

              {result && (
                <div className="animate-in fade-in zoom-in-95 space-y-2 rounded-xl border border-neutral-200 bg-gradient-to-br from-primary-50 to-white p-4 text-center duration-300 dark:border-neutral-800 dark:from-primary-950/30 dark:to-neutral-900">
                  <p className="text-3xl">
                    {result.resultPending
                      ? "🔒"
                      : result.isCorrect === true
                        ? "🎉"
                        : result.isCorrect === false
                          ? "💪"
                          : "✅"}
                  </p>
                  <p className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    {result.resultPending
                      ? t("dialog.lockedIn")
                      : result.isCorrect === true
                        ? t("dialog.correct")
                        : result.isCorrect === false
                          ? t("dialog.wrong")
                          : t("dialog.done")}
                  </p>
                  {result.resultPending && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {t("dialog.lockedInHint")}
                    </p>
                  )}
                  <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                    {t("dialog.pointsAwarded", { count: result.pointsAwarded })}
                  </p>
                  {!result.isRevealed && active.itemType === "QUESTION_OF_DAY" && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {t("dialog.revealLater")}
                    </p>
                  )}
                  {result.explanation && (
                    <RichText
                      html={result.explanation}
                      className="prose prose-sm mx-auto max-w-none text-sm text-neutral-600 dark:prose-invert dark:text-neutral-400"
                    />
                  )}
                </div>
              )}

              {/* Sentinel: intersecting means the content was scrolled through. */}
              <div ref={endRef} aria-hidden className="h-4 w-full" />

              <div className="flex items-center justify-end gap-2">
                {result ? (
                  <Button className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
                    {t("dialog.doneButton")}
                  </Button>
                ) : (
                  <Button
                    className="w-full sm:w-auto"
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                  >
                    {submitLabel}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small stagger for option entrance; capped so long lists never drag. */
function staggerClass(index: number): string {
  const steps = ["delay-0", "delay-75", "delay-150", "delay-200"];
  return steps[Math.min(index, steps.length - 1)]!;
}
