import React from "react";
import { CaretLeft, ClipboardText } from "@phosphor-icons/react";
import { useNavigate, useRouter } from "@tanstack/react-router";

interface AssessmentNavbarProps {
  title: string;
}

const AssessmentNavbar: React.FC<AssessmentNavbarProps> = ({ title }) => {
  const router = useRouter();
  const navigate = useNavigate();

  // Return to wherever the learner came from (usually the assessment list).
  // Direct / public-link entries have no in-app history to pop, so fall back to
  // the assessment tab.
  const handleBack = () => {
    if (window.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: "/assessment/examination/" });
    }
  };

  return (
    <div className="flex h-20 items-center gap-3 border-b border-primary-100 bg-gradient-to-r from-primary-50 to-primary-50/40 px-4 shadow-sm sm:px-6">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-primary-100 hover:text-primary-500"
      >
        <CaretLeft size={20} weight="bold" />
      </button>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-100">
        <ClipboardText size={18} weight="duotone" className="text-primary-500" />
      </div>
      <div className="min-w-0">
        {title && (
          <p className="truncate font-semibold text-neutral-800">{title}</p>
        )}
        <p className="text-xs font-medium text-primary-400 uppercase tracking-wide">
          Assessment Brief
        </p>
      </div>
    </div>
  );
};

export default AssessmentNavbar;
