import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import "./feedback.css";
import { z } from "zod";
import { useEffect, useState, useCallback } from "react";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "@/constants/urls";
import type {
  FeedbackConfigResponse,
  FeedbackQuestion,
} from "../-types/types";

export const Route = createFileRoute("/study-library/live-class/feedback/")(
  {
    validateSearch: z.object({
      scheduleId: z.string(),
    }),
    component: FeedbackPage,
  }
);

/* ─────────────────────── Star Rating Component ─────────────────────── */

function StarRating({
  value,
  onChange,
  maxStars = 5,
  allowHalf = true,
}: {
  value: number;
  onChange: (v: number) => void;
  maxStars?: number;
  allowHalf?: boolean;
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value;

  const handleClick = (
    starIndex: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (!allowHalf) {
      onChange(starIndex + 1);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    onChange(isLeft ? starIndex + 0.5 : starIndex + 1);
  };

  const handleMouseMove = (
    starIndex: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (!allowHalf) {
      setHoverValue(starIndex + 1);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    setHoverValue(isLeft ? starIndex + 0.5 : starIndex + 1);
  };

  return (
    <div
      className="feedback-stars"
      onMouseLeave={() => setHoverValue(null)}
    >
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = displayValue >= i + 1;
        const halfFilled = !filled && displayValue >= i + 0.5;
        return (
          <button
            key={i}
            type="button"
            className="feedback-star-btn"
            onClick={(e) => handleClick(i, e)}
            onMouseMove={(e) => handleMouseMove(i, e)}
          >
            <svg viewBox="0 0 24 24" className="feedback-star-svg">
              <defs>
                <linearGradient id={`half-grad-${i}`}>
                  <stop offset="50%" stopColor="var(--feedback-star)" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill={
                  filled
                    ? "var(--feedback-star)"
                    : halfFilled
                      ? `url(#half-grad-${i})`
                      : "transparent"
                }
                stroke="var(--feedback-star)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </button>
        );
      })}
      {value > 0 && (
        <span className="feedback-star-label">{value} / {maxStars}</span>
      )}
    </div>
  );
}

/* ─────────────────────── Main Feedback Page ─────────────────────── */

function FeedbackPage() {
  const { scheduleId } = Route.useSearch();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [config, setConfig] = useState<FeedbackConfigResponse | null>(null);
  const [responses, setResponses] = useState<Record<string, string | number>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Fetch feedback config. Do NOT auto-redirect when feedback is missing /
  // disabled — silently bouncing the learner away after the meeting ends made
  // it look like the page "flashed and disappeared". Instead, render a clear
  // thank-you state and let the learner navigate back themselves.
  useEffect(() => {
    if (!scheduleId) {
      navigate({ to: "/study-library/live-class" });
      return;
    }

    authenticatedAxiosInstance
      .get(
        `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/feedback-config`,
        { params: { scheduleId } }
      )
      .then((res) => {
        const data: FeedbackConfigResponse = res.data;
        // Diagnostic — verify what the API actually returned for this schedule.
        // Helpful when an admin enabled feedback but the form still doesn't
        // render (data may not have persisted on the matching session row).
        // eslint-disable-next-line no-console
        console.log("[Feedback] config response", data);
        setConfig(data);
        if (data.already_submitted) {
          setSubmitted(true);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[Feedback] failed to load feedback config", err);
        setConfig(null);
      })
      .finally(() => setLoading(false));
  }, [scheduleId, navigate]);

  // Auto-redirect after successful submission
  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => {
      navigate({ to: "/study-library/live-class" });
    }, 4000);
    return () => clearTimeout(timer);
  }, [submitted, navigate]);

  // ─── Compulsory feedback lock-in ──────────────────────────────────────────
  // When the admin sets feedback as compulsory (allow_skip === false), the
  // learner cannot exit the page through the app UI until they submit.
  // useBlocker.shouldBlockFn intercepts every in-app navigation — sidebar
  // links, back button, programmatic navigate() — and hard-blocks them
  // (returns true = block, no prompt). Tab close / refresh / external URLs
  // are intentionally NOT blocked; the browser-level beforeunload prompt
  // tends to be intrusive and the admin still gets backend enforcement
  // (LiveSessionProviderController.submitFeedback rejects empty mandatory
  // answers when allow_skip is false). UI also hides the Skip button and
  // shows a "Feedback required" banner so the learner understands why.
  const mustSubmit =
    !loading &&
    !submitted &&
    config?.feedback_config?.enabled === true &&
    config?.feedback_config?.allow_skip === false;

  useBlocker({
    shouldBlockFn: () => mustSubmit,
  });

  const enabledQuestions = (config?.feedback_config?.questions ?? []).filter(
    (q) => q.enabled
  );

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, boolean> = {};
    let valid = true;
    for (const q of enabledQuestions) {
      if (q.mandatory) {
        const val = responses[q.id];
        if (val === undefined || val === "" || val === 0) {
          newErrors[q.id] = true;
          valid = false;
        }
      }
    }
    setErrors(newErrors);
    return valid;
  }, [enabledQuestions, responses]);

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await authenticatedAxiosInstance.post(
        `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/feedback`,
        { schedule_id: scheduleId, responses }
      );
      // Server already collapses duplicates into 200 ({status: 'already_submitted'}),
      // so this branch is the only "submission succeeded" path.
      setSubmitted(true);
    } catch (e) {
      // Server-side rejections must NOT be treated as success — the prior
      // catch-all flipped to the success screen even when the backend
      // returned 400 validation_failed (e.g. compulsory feedback with an
      // empty mandatory answer), recording nothing. Keep the form visible
      // so the learner can fix and retry.
      // eslint-disable-next-line no-console
      console.error("[Feedback] submit failed", e);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <>
        <div className="feedback-page">
          <div className="feedback-loader">
            <div className="feedback-spinner" />
            <p>Loading feedback form…</p>
          </div>
        </div>
        <FeedbackStyles />
      </>
    );
  }

  /* ── Already-submitted / success state ── */
  if (submitted) {
    return (
      <>
        <div className="feedback-page">
          <div className="feedback-card feedback-success-card">
            <div className="feedback-success-icon">✓</div>
            <h2 className="feedback-success-title">Thank you for your feedback!</h2>
            <p className="feedback-success-subtitle">
              Your responses have been recorded. Redirecting you back…
            </p>
            <div className="feedback-redirect-bar" />
          </div>
        </div>
        <FeedbackStyles />
      </>
    );
  }

  /* ── No feedback configured for this session ── */
  // Reached when the API returned no feedback_config or feedback_config.enabled
  // is false. Show a friendly thank-you screen instead of silently redirecting,
  // so the learner sees something after the meeting and can navigate back when
  // ready.
  if (!config?.feedback_config?.enabled) {
    return (
      <>
        <div className="feedback-page">
          <div className="feedback-card feedback-success-card">
            <div className="feedback-success-icon">✓</div>
            <h2 className="feedback-success-title">Thanks for attending!</h2>
            <p className="feedback-success-subtitle">
              {config?.session_title
                ? `Hope you found "${config.session_title}" useful.`
                : "Hope you found the session useful."}
            </p>
            <button
              type="button"
              className="feedback-submit-btn"
              onClick={() => navigate({ to: "/study-library/live-class" })}
            >
              Back to live classes
            </button>
          </div>
        </div>
        <FeedbackStyles />
      </>
    );
  }

  /* ── Main feedback form ── */
  return (
    <>
      <div className="feedback-page">
      <div className="feedback-card">
        {/* Header / Branding */}
        <div className="feedback-header">
          {config?.institute_logo && (
            <img
              src={config.institute_logo}
              alt={config?.institute_name ?? "Logo"}
              className="feedback-logo"
            />
          )}
          <h1 className="feedback-title">Session Feedback</h1>
          {config?.session_title && (
            <p className="feedback-session-name">{config.session_title}</p>
          )}
          {config?.institute_name && (
            <p className="feedback-institute-name">{config.institute_name}</p>
          )}
        </div>

        {/* Compulsory-feedback notice */}
        {config?.feedback_config?.allow_skip === false && (
          <div
            role="note"
            style={{
              margin: "0 1.5rem 1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: "var(--feedback-warn-bg)",
              border: "1px solid var(--feedback-warn-border)",
              color: "var(--feedback-warn-text)",
              fontSize: "0.85rem",
              lineHeight: 1.4,
            }}
          >
            <strong>Feedback required.</strong> Your instructor has marked
            feedback as compulsory for this session — please complete all
            required questions to continue.
          </div>
        )}

        {/* Questions */}
        <div className="feedback-questions">
          {enabledQuestions.map((q: FeedbackQuestion) => (
            <div key={q.id} className="feedback-question">
              <label className="feedback-label">
                {q.label}
                {q.mandatory && <span className="feedback-required">*</span>}
              </label>

              {q.type === "star_rating" ? (
                <StarRating
                  value={(responses[q.id] as number) || 0}
                  onChange={(v) =>
                    setResponses((prev) => ({ ...prev, [q.id]: v }))
                  }
                  maxStars={q.max_stars ?? 5}
                  allowHalf={q.allow_half ?? true}
                />
              ) : (
                <textarea
                  className={`feedback-textarea ${errors[q.id] ? "feedback-textarea-error" : ""}`}
                  placeholder="Type your response here…"
                  value={(responses[q.id] as string) || ""}
                  onChange={(e) => {
                    setResponses((prev) => ({
                      ...prev,
                      [q.id]: e.target.value,
                    }));
                    if (errors[q.id]) {
                      setErrors((prev) => ({ ...prev, [q.id]: false }));
                    }
                  }}
                  rows={3}
                  maxLength={2000}
                />
              )}

              {errors[q.id] && (
                <span className="feedback-error-text">This field is required</span>
              )}
            </div>
          ))}
        </div>

        {/* Submit */}
        <button
          type="button"
          className="feedback-submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <span className="feedback-btn-loading">
              <span className="feedback-spinner-sm" /> Submitting…
            </span>
          ) : (
            "Submit Feedback"
          )}
        </button>

        {config?.feedback_config?.allow_skip !== false && (
          <button
            type="button"
            className="feedback-skip-btn"
            onClick={() => navigate({ to: "/study-library/live-class" })}
          >
            Skip
          </button>
        )}
      </div>
      </div>

      <FeedbackStyles />
    </>
  );
}

/* Styles moved to ./feedback.css */
function FeedbackStyles() {
  return null;
}
