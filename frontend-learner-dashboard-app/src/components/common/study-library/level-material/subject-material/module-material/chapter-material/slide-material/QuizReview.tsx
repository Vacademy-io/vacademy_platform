import React, { useEffect, useMemo, useState } from "react";
import type { ScoreCard } from "./quiz-viewer";
import type { QuizAttemptLog, QuizSideEntry } from "@/services/study-library/tracking-api/get-quiz-slide-activity-logs";
import { getPublicUrl } from "@/services/upload_file";

interface Option {
  id: string;
  text: { content: string };
}

interface Question {
  id: string;
  parent_rich_text?: {
    id?: string;
    type?: string;
    content?: string;
  };
  text?: {
    id?: string;
    type?: string;
    content?: string;
  } | string;
  text_data?: {
    id?: string;
    type?: string;
    content?: string;
  };
  options: Option[];
  question_type?: string;
  explanation_text?: {
    id?: string;
    type?: string;
    content?: string;
  };
  auto_evaluation_json?: string;
}

interface QuizReviewProps {
  questions: Question[];
  userAnswers: { [questionId: string]: string | number | string[] };
  onRestart: () => void;
  scoreCard?: ScoreCard;
  showCorrectAnswers?: boolean;
  passed?: boolean | null;
  passPercentage?: number | null;
  attemptNumber?: number;
  maxAttempts?: number | null;
  canReattempt?: boolean;
  attemptLogs?: QuizAttemptLog[];
}

const getQuestionText = (q: Question) => {
  if (q.text && typeof q.text === 'object' && q.text.content) return q.text.content;
  if (q.text_data?.content) return q.text_data.content;
  if (typeof q.text === 'string') return q.text;
  return "";
};

const getPassageText = (q: Question) => q.parent_rich_text?.content || "";
const getExplanationText = (q: Question) => q.explanation_text?.content || "";

// Helper to render comma-separated React elements
function renderCommaSeparated(elements: React.ReactNode[]) {
  return elements.flatMap((el, idx) =>
    idx === 0 ? [el] : [<span key={`sep-${idx}`}>, </span>, el]
  );
}

const InstructorFeedbackPanel = ({
  feedback,
  fileId,
}: {
  feedback: string;
  fileId: string;
}) => {
  const [fileUrl, setFileUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (fileId) {
      getPublicUrl(fileId)
        .then((url) => {
          if (!cancelled) setFileUrl(url);
        })
        .catch(() => {
          if (!cancelled) setFileUrl("");
        });
    } else {
      setFileUrl("");
    }
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (!feedback && !fileId) return null;
  return (
    <div className="mt-2 rounded-lg border border-primary-200 bg-primary-50 p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-600">
        Instructor feedback
      </div>
      {feedback && (
        <div className="whitespace-pre-wrap text-sm text-neutral-800">
          {feedback}
        </div>
      )}
      {fileId && fileUrl && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-500 hover:underline"
        >
          View attachment
        </a>
      )}
    </div>
  );
};

const getOptionHtml = (q: Question, idOrValue: string | number | undefined) => {
  // ✅ Handle undefined/null values
  if (idOrValue === undefined || idOrValue === null || idOrValue === '') {
    return "No answer selected";
  }
  
  if (q.options && q.options.length > 0 && typeof idOrValue === 'string') {
    const opt = q.options.find(o => o.id === idOrValue);
    if (opt) return opt.text.content;
  }
  
  return String(idOrValue);
};

const getCorrectAnswers = (q: Question): (string | number)[] => {
  if (q.auto_evaluation_json) {
    try {
      const parsed = JSON.parse(q.auto_evaluation_json);
      if (Array.isArray(parsed.correctAnswers)) {
        if (typeof parsed.correctAnswers[0] === 'number' && q.options?.length) {
          return parsed.correctAnswers.map((idx: number) => q.options[idx]?.id ?? idx);
        }
        return parsed.correctAnswers;
      }
      if (typeof parsed.correctAnswers === 'string' || typeof parsed.correctAnswers === 'number') {
        return [parsed.correctAnswers];
      }
      // Handle { data: { answer: ... } }
      if (parsed.data) {
        if (typeof parsed.data.answer === 'string' || typeof parsed.data.answer === 'number') {
          return [parsed.data.answer];
        }
        if (parsed.data.answer && typeof parsed.data.answer === 'object' && typeof parsed.data.answer.content === 'string') {
          // For LONG_ANSWER: answer is in content (HTML string)
          return [parsed.data.answer.content];
        }
      }
    } catch {
      // ignore
    }
  }
  return [];
};

export const QuizReview: React.FC<QuizReviewProps> = ({ questions, userAnswers, onRestart, scoreCard, showCorrectAnswers = true, passed, passPercentage, attemptNumber, maxAttempts, canReattempt = true, attemptLogs }) => {
  const [showFullPassageIdx, setShowFullPassageIdx] = useState<number | null>(null);
  const [showPastAttempts, setShowPastAttempts] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  // The attempt whose per-question feedback is currently being shown.
  // Backend ordering of attemptLogs varies (asc vs desc); pick the attempt
  // with the latest timestamp AND non-empty quiz_sides so we always show the
  // learner's most recent meaningful attempt.
  const activeAttempt = useMemo(() => {
    if (!attemptLogs || attemptLogs.length === 0) return null;
    if (selectedAttemptId) {
      return attemptLogs.find((a) => a.id === selectedAttemptId) ?? attemptLogs[0];
    }
    const ts = (l: QuizAttemptLog) =>
      new Date(l.end_time ?? l.start_time ?? 0).getTime();
    const sorted = [...attemptLogs].sort((a, b) => ts(b) - ts(a));
    return sorted.find((a) => (a.quiz_sides?.length ?? 0) > 0) ?? sorted[0];
  }, [attemptLogs, selectedAttemptId]);

  const defaultLatestAttemptId = useMemo(() => {
    if (!attemptLogs || attemptLogs.length === 0) return null;
    const ts = (l: QuizAttemptLog) =>
      new Date(l.end_time ?? l.start_time ?? 0).getTime();
    const sorted = [...attemptLogs].sort((a, b) => ts(b) - ts(a));
    return (sorted.find((a) => (a.quiz_sides?.length ?? 0) > 0) ?? sorted[0])?.id ?? null;
  }, [attemptLogs]);

  const isViewingPastAttempt =
    !!attemptLogs && !!activeAttempt && defaultLatestAttemptId !== activeAttempt.id;

  // Count feedback entries (text or file) per attempt — used to show a
  // "N notes" indicator in the Past Attempts list.
  const feedbackCountByAttemptId = useMemo(() => {
    const counts = new Map<string, number>();
    attemptLogs?.forEach((a) => {
      const count =
        a.quiz_sides?.filter(
          (qs) =>
            (qs.instructor_feedback && qs.instructor_feedback.trim() !== '') ||
            qs.instructor_feedback_file_id
        ).length ?? 0;
      counts.set(a.id, count);
    });
    return counts;
  }, [attemptLogs]);

  // Per-question feedback for the active attempt.
  const feedbackByQuestionId = useMemo(() => {
    const map = new Map<string, QuizSideEntry>();
    activeAttempt?.quiz_sides?.forEach((qs) => {
      if (qs.question_id) map.set(qs.question_id, qs);
    });
    return map;
  }, [activeAttempt]);

  // Per-attempt score summary derived from the persisted quiz_sides response_json.
  // Two code paths depending on payload shape:
  //   - ENRICHED (today's quiz-viewer enrichment, response_json has marks +
  //     maxMarks + isCorrect): sum the persisted marks/maxMarks directly.
  //   - LEGACY ({answer:<id>} only, response_status="SUBMITTED"): we have to
  //     derive correctness. Look up the question by id, compare the saved
  //     answer ids against getCorrectAnswers(q), and award 1 mark per correct.
  //     (The original marks_per_question isn't stored on legacy quiz_sides;
  //     1 mark per question keeps the score in the same scale as the total.)
  // NOTE: declared here (BEFORE activeAttemptScore / effectiveScoreCard) because
  // those downstream consts call .get() on it during render. Moving this lower
  // triggers a temporal-dead-zone ReferenceError in production builds.
  const scoreByAttemptId = useMemo(() => {
    const map = new Map<string, { earned: number; total: number; pct: number }>();
    const questionLookup = new Map<string, Question>();
    questions.forEach((q) => {
      if (q.id) questionLookup.set(q.id, q);
    });
    attemptLogs?.forEach((a) => {
      let earned = 0;
      let total = 0;
      a.quiz_sides?.forEach((qs) => {
        let parsed:
          | {
              marks?: number;
              maxMarks?: number;
              isCorrect?: boolean;
              answer?: string | number | string[];
              selectedOptions?: Array<{ id: string }>;
            }
          | null = null;
        if (qs.response_json) {
          try {
            parsed = JSON.parse(qs.response_json);
          } catch {
            parsed = null;
          }
        }
        // Enriched payload — trust the persisted marks/maxMarks.
        if (parsed && typeof parsed.maxMarks === 'number') {
          total += parsed.maxMarks;
          if (typeof parsed.marks === 'number') {
            earned += Math.max(0, parsed.marks);
          } else if (parsed.isCorrect) {
            earned += parsed.maxMarks;
          }
          return;
        }
        // Legacy payload — score by comparing saved answer vs current correct answers.
        total += 1;
        if (!parsed) return;
        const q = questionLookup.get(qs.question_id);
        if (!q) return;
        const answerIds: string[] =
          Array.isArray(parsed.selectedOptions) && parsed.selectedOptions.length > 0
            ? parsed.selectedOptions.map((o) => String(o.id))
            : parsed.answer != null
              ? Array.isArray(parsed.answer)
                ? parsed.answer.map(String)
                : [String(parsed.answer)]
              : [];
        if (answerIds.length === 0) return;
        const correctIds = getCorrectAnswers(q).map(String);
        if (correctIds.length === 0) return;
        const isCorrect =
          answerIds.length === correctIds.length &&
          correctIds.every((c) => answerIds.includes(c));
        if (isCorrect) earned += 1;
      });
      const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
      map.set(a.id, { earned, total, pct });
    });
    return map;
  }, [attemptLogs, questions]);

  // Per-question learner answer for the active attempt, parsed from quiz_sides.
  // When viewing the default-latest attempt this typically matches the
  // `userAnswers` prop (parent computes it the same way), but for past attempts
  // the prop is stale, so we override on a per-question basis.
  const activeAttemptAnswers = useMemo(() => {
    const map = new Map<string, string | number | string[]>();
    activeAttempt?.quiz_sides?.forEach((qs) => {
      if (!qs.question_id || !qs.response_json) return;
      try {
        const parsed = JSON.parse(qs.response_json);
        if (Array.isArray(parsed.selectedOptions) && parsed.selectedOptions.length > 0) {
          const ids = parsed.selectedOptions.map((o: { id: string }) => String(o.id));
          map.set(qs.question_id, ids.length === 1 ? ids[0] : ids);
        } else if (parsed.answer != null) {
          map.set(
            qs.question_id,
            Array.isArray(parsed.answer)
              ? parsed.answer.map(String)
              : (parsed.answer as string | number),
          );
        }
      } catch {
        // skip malformed entries
      }
    });
    return map;
  }, [activeAttempt]);

  // Score for the active attempt — drives the Score Card and Pass/Fail banner
  // when the learner clicks into a past attempt.
  // Decision matrix:
  //   - active attempt has real quiz_sides → compute from scoreByAttemptId
  //   - active attempt has empty quiz_sides (defensive — should not happen
  //     after the backend sourceType filter, but keep as safety net) →
  //     synthesize a zero-score card so the learner sees 0 / N with all
  //     questions marked as Skipped, instead of an empty UI or (worse) the
  //     LATEST attempt's score leaking through
  //   - no active attempt (e.g. fresh submission, attemptLogs not loaded yet)
  //     → fall back to the parent's scoreCard prop
  const activeAttemptScore = scoreByAttemptId.get(activeAttempt?.id ?? '') ?? null;
  const activeAttemptHasData =
    (activeAttempt?.quiz_sides?.length ?? 0) > 0 && (activeAttemptScore?.total ?? 0) > 0;
  const effectiveScoreCard = activeAttemptHasData
    ? {
        earned: activeAttemptScore!.earned,
        totalMarks: activeAttemptScore!.total,
        correct: 0,
        wrong: 0,
        skipped: 0,
      }
    : activeAttempt && !activeAttemptHasData && questions.length > 0
      ? {
          earned: 0,
          totalMarks: questions.length,
          correct: 0,
          wrong: 0,
          skipped: questions.length,
        }
      : scoreCard;
  // Recompute correct/wrong/skipped counts for the active attempt so the
  // score card breakdown stays in sync with what's shown per-question.
  const effectiveScoreCardWithCounts = useMemo(() => {
    if (!effectiveScoreCard) return scoreCard;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    questions.forEach((q) => {
      const ans = activeAttemptAnswers.get(q.id) ?? userAnswers[q.id];
      const isAnswered =
        ans != null && !(typeof ans === 'string' && ans.trim() === '') && !(Array.isArray(ans) && ans.length === 0);
      if (!isAnswered) {
        skipped++;
        return;
      }
      const correctAnswers = getCorrectAnswers(q);
      const ok =
        correctAnswers.length > 0 &&
        (Array.isArray(ans)
          ? ans.length === correctAnswers.length && correctAnswers.map(String).every((c) => ans.map(String).includes(c))
          : correctAnswers.map(String).includes(String(ans)));
      if (ok) correct++;
      else wrong++;
    });
    return { ...effectiveScoreCard, correct, wrong, skipped };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveScoreCard, activeAttemptAnswers, userAnswers, questions]);
  const effectivePassed =
    effectiveScoreCardWithCounts && passPercentage != null && effectiveScoreCardWithCounts.totalMarks > 0
      ? (effectiveScoreCardWithCounts.earned / effectiveScoreCardWithCounts.totalMarks) * 100 >= passPercentage
      : passed;

  const PASSAGE_LIMIT = 200;

  // Helper to get plain text from HTML
  const getPlainText = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  // Inline SVG for checkmark
  const CheckIcon = ({ className = "text-green-600" }: { className?: string } = {}) => (
    <svg className={`inline-block mr-1 ${className}`} width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 10.5L9 14.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  // Inline SVG for cross / X
  const CrossIcon = ({ className = "text-red-600" }: { className?: string } = {}) => (
    <svg className={`inline-block mr-1 ${className}`} width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  // Inline SVG for user icon
  const UserIcon = () => (
    <svg className="inline-block mr-1 text-blue-600" width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M2 18c0-2.21 3.582-4 8-4s8 1.79 8 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  // Helper to get option label (a), b), c), ...)
  const getOptionLabel = (idx: number) => String.fromCharCode(97 + idx) + ") ";

  return (
    <div className="w-full min-h-screen-80 bg-white rounded-xl shadow-lg p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-primary-800 text-base font-bold">Quiz Review</h2>
          {attemptNumber != null && attemptNumber > 0 && (
            <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700">
              Attempt {attemptNumber}{maxAttempts != null ? ` / ${maxAttempts}` : ''}
            </span>
          )}
        </div>
        {canReattempt ? (
          <button
            className="px-4 py-2 bg-secondary-500 hover:bg-primary-100 text-black font-semibold text-xs border rounded shadow transition-colors"
            onClick={onRestart}
            type="button"
          >
            Reattempt
          </button>
        ) : (
          <span className="px-4 py-2 text-xs font-medium text-gray-400">
            No attempts remaining
          </span>
        )}
      </div>

      {/* Score Card — driven by the active attempt when the learner clicks
          into a past attempt; otherwise reflects the latest/freshly-submitted
          attempt scoreCard prop. */}
      {effectiveScoreCardWithCounts && effectiveScoreCardWithCounts.totalMarks > 0 && (
        <div className="mb-8 rounded-xl border border-primary-200 bg-primary-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">📊</span>
            <span className="font-semibold text-primary-800">
              {isViewingPastAttempt ? 'Attempt Score' : 'Your Score'}
            </span>
          </div>
          <div className="mb-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary-700">
              {effectiveScoreCardWithCounts.earned % 1 === 0
                ? effectiveScoreCardWithCounts.earned
                : effectiveScoreCardWithCounts.earned.toFixed(2)}
            </span>
            <span className="text-lg text-primary-500">/ {effectiveScoreCardWithCounts.totalMarks} marks</span>
            <span className="ml-auto rounded-full bg-primary-100 px-3 py-1 text-sm font-semibold text-primary-700">
              {effectiveScoreCardWithCounts.totalMarks > 0
                ? Math.round((effectiveScoreCardWithCounts.earned / effectiveScoreCardWithCounts.totalMarks) * 100)
                : 0}%
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-green-700">
              <span>✅</span> Correct: {effectiveScoreCardWithCounts.correct}
            </span>
            <span className="flex items-center gap-1.5 font-medium text-red-600">
              <span>❌</span> Wrong: {effectiveScoreCardWithCounts.wrong}
            </span>
            <span className="flex items-center gap-1.5 font-medium text-gray-500">
              <span>⏭</span> Skipped: {effectiveScoreCardWithCounts.skipped}
            </span>
          </div>
        </div>
      )}

      {/* Pass / Fail Banner */}
      {effectivePassed === true && (
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <span className="text-2xl">🎉</span>
          <div>
            <div className="font-semibold text-green-800">
              {isViewingPastAttempt ? 'Attempt passed' : 'You passed!'}
            </div>
            <div className="text-sm text-green-700">
              Required: {passPercentage}% — Score:{" "}
              {effectiveScoreCardWithCounts && effectiveScoreCardWithCounts.totalMarks > 0
                ? Math.round((effectiveScoreCardWithCounts.earned / effectiveScoreCardWithCounts.totalMarks) * 100)
                : 0}
              %
            </div>
          </div>
        </div>
      )}
      {effectivePassed === false && (
        <div className="mb-8 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">😔</span>
            <div>
              <div className="font-semibold text-red-800">
                {isViewingPastAttempt ? 'Attempt did not pass' : 'You did not pass'}
              </div>
              <div className="text-sm text-red-700">
                Required: {passPercentage}% — Score:{" "}
                {effectiveScoreCardWithCounts && effectiveScoreCardWithCounts.totalMarks > 0
                  ? Math.round((effectiveScoreCardWithCounts.earned / effectiveScoreCardWithCounts.totalMarks) * 100)
                  : 0}
                %
              </div>
            </div>
          </div>
          {/* Reattempt button intentionally still uses canReattempt (overall
              attempts-remaining business logic) — NOT the viewed attempt. */}
          {!isViewingPastAttempt && (
            <button
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow transition-colors ${canReattempt ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-300 cursor-not-allowed'}`}
              onClick={canReattempt ? onRestart : undefined}
              disabled={!canReattempt}
              type="button"
            >
              {canReattempt ? 'Reattempt Quiz' : 'No attempts remaining'}
            </button>
          )}
        </div>
      )}

      {/* Past Attempts */}
      {attemptLogs && attemptLogs.length > 1 && (
        <div className="mb-8">
          <button
            type="button"
            className="mb-2 text-sm font-semibold text-primary-700 hover:underline"
            onClick={() => setShowPastAttempts(!showPastAttempts)}
          >
            {showPastAttempts ? "▾ Hide" : "▸ View"} Past Attempts ({attemptLogs.length})
          </button>
          {showPastAttempts && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="space-y-2">
                {attemptLogs.map((log, i) => {
                  const attemptNum = attemptLogs.length - i;
                  const isActive = activeAttempt?.id === log.id;
                  const feedbackCount = feedbackCountByAttemptId.get(log.id) ?? 0;
                  const score = scoreByAttemptId.get(log.id);
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setSelectedAttemptId(log.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm shadow-sm transition-colors ${
                        isActive
                          ? 'border border-primary-300 bg-primary-50'
                          : 'border border-transparent bg-white hover:border-primary-200 hover:bg-primary-50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">
                          Attempt #{attemptNum}
                        </span>
                        {score && score.total > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {score.earned}/{score.total} ({score.pct}%)
                          </span>
                        )}
                        {feedbackCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                            📝 {feedbackCount} {feedbackCount === 1 ? 'note' : 'notes'}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400">
                        {log.end_time ? new Date(log.end_time).toLocaleString() : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Past-attempt notice — shown when the learner clicked a non-latest attempt */}
      {isViewingPastAttempt && activeAttempt && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
          <div className="text-sm text-primary-700">
            {activeAttemptHasData
              ? 'Viewing a past attempt.'
              : 'This attempt has no recorded responses — all questions are shown as Skipped.'}
            {activeAttempt.end_time && (
              <span className="ml-1 text-xs text-primary-600">
                ({new Date(activeAttempt.end_time).toLocaleString()})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSelectedAttemptId(null)}
            className="rounded-md border border-primary-300 bg-white px-3 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100"
          >
            Back to latest
          </button>
        </div>
      )}

      <div className="space-y-10">
        {questions.map((q, idx) => {
          const passage = getPassageText(q);
          const questionText = getQuestionText(q);
          const explanation = getExplanationText(q);
          // When viewing a past attempt, show ONLY that attempt's answer (no
          // fallback to the latest, which would mix data across attempts).
          // For the default-latest view, fall back to the userAnswers prop so
          // the localStorage path / brand-new submissions still render before
          // the backend refetch lands.
          const userAnswer = isViewingPastAttempt
            ? activeAttemptAnswers.get(q.id)
            : (activeAttemptAnswers.get(q.id) ?? userAnswers[q.id]);
          const correctAnswers = getCorrectAnswers(q);
          const isMulti = Array.isArray(userAnswer);
          const feedbackEntry = feedbackByQuestionId.get(q.id);

          // Passage show more/less logic
          const passagePlain = getPlainText(passage);
          const isPassageLong = passagePlain.length > PASSAGE_LIMIT;
          const showFull = showFullPassageIdx === idx;
          const passageToShow = showFull || !isPassageLong
            ? passage
            : passagePlain.slice(0, PASSAGE_LIMIT) + "...";

          // For MCQ/Multiple, show option labels
          const isMCQ = Array.isArray(q.options) && q.options.length > 1 && q.options[0]?.id;

          // For 'Your Answer', get the index in q.options for each selected id
          const getUserAnswerWithIndex = () => {
            if (isMulti && isMCQ) {
              return (userAnswer as (string | number)[]).map((id) => {
                const idx = q.options.findIndex(opt => opt.id === id);
                return { id, idx };
              });
            } else if (isMCQ) {
              const idx = q.options.findIndex(opt => opt.id === userAnswer);
              return [{ id: userAnswer, idx }];
            }
            return null;
          };

          // For 'Correct Answer', sort by q.options order if MCQ
          const getCorrectAnswerWithIndex = () => {
            if (isMCQ) {
              return q.options
                .map((opt, idx) => correctAnswers.includes(opt.id) ? { id: opt.id, idx } : null)
                .filter(Boolean);
            }
            return correctAnswers.map((id) => ({ id, idx: 0 }));
          };

          const userAnswerWithIndex = getUserAnswerWithIndex();
          const correctAnswerWithIndex = getCorrectAnswerWithIndex();

          const hasUserAnswer = !(
            userAnswer === undefined ||
            userAnswer === null ||
            userAnswer === '' ||
            (Array.isArray(userAnswer) && userAnswer.length === 0)
          );
          const isUserAnswerCorrect = (() => {
            if (!hasUserAnswer || correctAnswers.length === 0) return false;
            const correctSet = new Set(correctAnswers.map(String));
            if (Array.isArray(userAnswer)) {
              const userSet = new Set(userAnswer.map(String));
              if (userSet.size !== correctSet.size) return false;
              for (const v of userSet) if (!correctSet.has(v)) return false;
              return true;
            }
            return correctSet.has(String(userAnswer));
          })();
          const answerStatus: 'correct' | 'wrong' | 'skipped' = !hasUserAnswer
            ? 'skipped'
            : isUserAnswerCorrect
              ? 'correct'
              : 'wrong';
          const yourAnswerStyles = {
            correct: {
              label: 'text-green-800',
              box: 'bg-green-50 border-green-200',
              text: 'text-green-900',
            },
            wrong: {
              label: 'text-red-800',
              box: 'bg-red-50 border-red-200',
              text: 'text-red-900',
            },
            skipped: {
              label: 'text-blue-800',
              box: 'bg-blue-50 border-blue-200',
              text: 'text-blue-900',
            },
          }[answerStatus];

          return (
            <div key={q.id} className="p-6 rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
              <div className="mb-2 text-xs text-gray-500 font-medium">Question {idx + 1}</div>
              {passage && (
                <div className="mb-4 p-4 bg-gray-100 rounded border border-gray-200">
                  <div className="text-xs font-semibold text-gray-700 mb-1">Passage:</div>
                  <div className="text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: passageToShow }} />
                  {isPassageLong && (
                    <button
                      className="mt-2 text-primary-600 hover:underline text-xs font-medium focus:outline-none"
                      onClick={() => setShowFullPassageIdx(showFull ? null : idx)}
                      type="button"
                    >
                      {showFull ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              )}
              <div className="mb-4">
                {/* <span className="font-semibold text-gray-700">Q:</span>{" "} */}
                <span className="text-gray-900 text-xs" dangerouslySetInnerHTML={{ __html: questionText }} />
              </div>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <div className={`mb-1 text-xs font-semibold flex items-center ${yourAnswerStyles.label}`}>
                    {answerStatus === 'correct' && <CheckIcon />}
                    {answerStatus === 'wrong' && <CrossIcon />}
                    {answerStatus === 'skipped' && <UserIcon />}
                    Your Answer
                  </div>
                  <div className={`w-full rounded-lg border p-3 flex flex-col gap-2 ${yourAnswerStyles.box}`}>
                    {!hasUserAnswer ? (
                      <span className="text-gray-500 italic text-sm">No answer selected</span>
                    ) : isMCQ && userAnswerWithIndex
                      ? userAnswerWithIndex.map(({ id, idx }) => (
                          <span key={id as string} className={`text-sm flex items-center ${yourAnswerStyles.text}`}>
                            <span className="font-bold mr-1">{getOptionLabel(idx)}</span>
                            <span dangerouslySetInnerHTML={{ __html: getOptionHtml(q, id) }} />
                          </span>
                        ))
                      : isMulti
                        ? (userAnswer as (string | number)[]).map((id) => (
                            <span key={id as string} className={`text-sm flex items-center ${yourAnswerStyles.text}`}>
                              <span dangerouslySetInnerHTML={{ __html: getOptionHtml(q, id) }} />
                            </span>
                          ))
                        : <span className={`text-sm flex items-center ${yourAnswerStyles.text}`}>
                            <span dangerouslySetInnerHTML={{ __html: getOptionHtml(q, userAnswer) }} />
                          </span>}
                  </div>
                </div>
                {showCorrectAnswers && correctAnswers.length > 0 && (
                  <div className="flex-1">
                    <div className="mb-1 text-xs font-semibold text-green-800 flex items-center"><CheckIcon />Correct Answer</div>
                    <div className="w-full rounded-lg bg-green-50 border border-green-200 p-3 flex flex-col gap-2">
                      {isMCQ && correctAnswerWithIndex
                        ? correctAnswerWithIndex.map(({ id, idx }) => (
                            <span key={id as string} className="text-green-900 text-sm flex items-center">
                              <span className="font-bold mr-1">{getOptionLabel(idx)}</span>
                              <span dangerouslySetInnerHTML={{ __html: getOptionHtml(q, id) }} />
                            </span>
                          ))
                        : correctAnswers.map((id) => (
                            <span key={id as string} className="text-green-900 text-sm flex items-center">
                              <span dangerouslySetInnerHTML={{ __html: getOptionHtml(q, id) }} />
                            </span>
                          ))}
                    </div>
                  </div>
                )}
              </div>
              {showCorrectAnswers && explanation && (
                <div className="mt-2 p-4 bg-gray-100 border border-gray-300 rounded-lg">
                  <div className="mb-1 text-xs font-semibold text-gray-700">Explanation</div>
                  <div className="text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: explanation }} />
                </div>
              )}
              {feedbackEntry && (
                <InstructorFeedbackPanel
                  feedback={feedbackEntry.instructor_feedback ?? ""}
                  fileId={feedbackEntry.instructor_feedback_file_id ?? ""}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuizReview; 