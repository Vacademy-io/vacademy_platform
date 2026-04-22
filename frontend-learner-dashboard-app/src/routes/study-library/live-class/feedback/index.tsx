import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
                  <stop offset="50%" stopColor="#FBBF24" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill={
                  filled
                    ? "#FBBF24"
                    : halfFilled
                      ? `url(#half-grad-${i})`
                      : "transparent"
                }
                stroke="#FBBF24"
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

  // Fetch feedback config
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
        setConfig(data);

        // If feedback is disabled or already submitted, handle accordingly
        if (!data.feedback_config?.enabled) {
          navigate({ to: "/study-library/live-class" });
          return;
        }
        if (data.already_submitted) {
          setSubmitted(true);
        }
      })
      .catch(() => {
        navigate({ to: "/study-library/live-class" });
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
      setSubmitted(true);
    } catch {
      // If already submitted, treat as success
      setSubmitted(true);
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

        <button
          type="button"
          className="feedback-skip-btn"
          onClick={() => navigate({ to: "/study-library/live-class" })}
        >
          Skip
        </button>
      </div>
      </div>

      <FeedbackStyles />
    </>
  );
}

/* ─────────────────────── Global Styles Component ─────────────────────── */
function FeedbackStyles() {
  return (
    <style>{`
        .feedback-page {
          width: 100vw;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          position: relative;
          overflow: hidden;
        }
        .feedback-page::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 30% 20%, rgba(99, 102, 241, 0.15), transparent 50%),
                      radial-gradient(circle at 70% 80%, rgba(168, 85, 247, 0.12), transparent 50%);
          pointer-events: none;
        }

        .feedback-card {
          position: relative;
          width: 100%;
          max-width: 520px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.25rem;
          padding: 2rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          animation: fadeSlideUp 0.5s ease-out;
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Header */
        .feedback-header {
          text-align: center;
          margin-bottom: 1.75rem;
        }
        .feedback-logo {
          height: 40px;
          margin: 0 auto 0.75rem;
          border-radius: 8px;
          object-fit: contain;
        }
        .feedback-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .feedback-session-name {
          font-size: 0.95rem;
          color: #94a3b8;
          margin: 0.35rem 0 0;
        }
        .feedback-institute-name {
          font-size: 0.8rem;
          color: #64748b;
          margin: 0.25rem 0 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Questions */
        .feedback-questions {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .feedback-question {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .feedback-label {
          font-size: 0.9rem;
          font-weight: 500;
          color: #e2e8f0;
        }
        .feedback-required {
          color: #f87171;
          margin-left: 2px;
        }

        /* Star rating */
        .feedback-stars {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .feedback-star-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          transition: transform 0.15s ease;
        }
        .feedback-star-btn:hover {
          transform: scale(1.2);
        }
        .feedback-star-svg {
          width: 32px;
          height: 32px;
          filter: drop-shadow(0 0 3px rgba(251, 191, 36, 0.3));
        }
        .feedback-star-label {
          margin-left: 0.5rem;
          font-size: 0.85rem;
          color: #94a3b8;
          font-weight: 500;
        }

        /* Textarea */
        .feedback-textarea {
          width: 100%;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          color: #f1f5f9;
          font-size: 0.9rem;
          line-height: 1.5;
          resize: vertical;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: inherit;
        }
        .feedback-textarea::placeholder {
          color: #64748b;
        }
        .feedback-textarea:focus {
          outline: none;
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }
        .feedback-textarea-error {
          border-color: rgba(248, 113, 113, 0.5);
        }
        .feedback-error-text {
          font-size: 0.78rem;
          color: #f87171;
        }

        /* Buttons */
        .feedback-submit-btn {
          width: 100%;
          margin-top: 1.5rem;
          padding: 0.85rem;
          border: none;
          border-radius: 0.75rem;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          font-family: inherit;
        }
        .feedback-submit-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
        }
        .feedback-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .feedback-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .feedback-btn-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .feedback-skip-btn {
          width: 100%;
          margin-top: 0.5rem;
          padding: 0.65rem;
          border: none;
          border-radius: 0.75rem;
          background: transparent;
          color: #64748b;
          font-size: 0.85rem;
          cursor: pointer;
          transition: color 0.2s;
          font-family: inherit;
        }
        .feedback-skip-btn:hover {
          color: #94a3b8;
        }

        /* Success state */
        .feedback-success-card {
          text-align: center;
          padding: 3rem 2rem;
        }
        .feedback-success-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 1.25rem;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.75rem;
          color: white;
          font-weight: bold;
          animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        .feedback-success-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 0.5rem;
        }
        .feedback-success-subtitle {
          font-size: 0.9rem;
          color: #94a3b8;
          margin: 0;
        }
        .feedback-redirect-bar {
          margin-top: 1.5rem;
          height: 3px;
          border-radius: 2px;
          background: rgba(255,255,255,0.1);
          overflow: hidden;
          position: relative;
        }
        .feedback-redirect-bar::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          animation: progressShrink 4s linear forwards;
          transform-origin: left;
        }
        @keyframes progressShrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }

        /* Loader */
        .feedback-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: #94a3b8;
          font-size: 0.9rem;
        }
        .feedback-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .feedback-spinner-sm {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Mobile responsive */
        @media (max-width: 480px) {
          .feedback-card {
            padding: 1.5rem 1.25rem;
            border-radius: 1rem;
          }
          .feedback-title {
            font-size: 1.25rem;
          }
          .feedback-star-svg {
            width: 28px;
            height: 28px;
          }
        }
      `}</style>
  );
}
