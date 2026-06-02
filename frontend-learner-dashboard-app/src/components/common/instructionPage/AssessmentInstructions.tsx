import type { ReactNode } from "react";
import { formatDuration } from "@/constants/helper";
import { Assessment } from "@/types/assessment";
import {
  Clock,
  Eye,
  ArrowsLeftRight,
  ListChecks,
  Info,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface AssessmentInstructionsProps {
  instructions: string;
  duration: number;
  preview: boolean;
  canSwitchSections: boolean;
  assessmentInfo: Assessment;
}

const getAttemptInfo = (assessmentInfo: Assessment) => {
  // assessment_attempts is the globally configured max; created_attempts is how
  // many the user has already used. Show the next attempt number (used + 1) out
  // of the configured max so the learner sees "Attempt 1 of 5" before starting.
  const maxAttempts = assessmentInfo.assessment_attempts ?? 1;
  const usedAttempts = assessmentInfo.created_attempts ?? 0;
  return { used: usedAttempts, max: maxAttempts };
};

interface MetaCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}

const MetaCard = ({ icon, label, value, highlight }: MetaCardProps) => (
  <div
    className={cn(
      "flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-3 text-center",
      highlight
        ? "border-primary-200 bg-primary-50"
        : "border-neutral-100 bg-white"
    )}
  >
    <div className="text-primary-400">{icon}</div>
    <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
      {label}
    </span>
    <span className="text-sm font-bold text-neutral-800">{value}</span>
  </div>
);

export const AssessmentInstructions = ({
  instructions,
  duration,
  preview,
  canSwitchSections,
  assessmentInfo,
}: AssessmentInstructionsProps) => {
  const { used, max } = getAttemptInfo(assessmentInfo);
  const showAttempts =
    assessmentInfo.play_mode !== "PRACTICE" &&
    assessmentInfo.play_mode !== "MOCK";

  return (
    <div className="w-full space-y-5">
      {/* Attempt badge */}
      {showAttempts && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
            <ListChecks size={13} weight="bold" />
            Attempt {used + 1} of {max}
          </span>
          {used > 0 && (
            <span className="text-xs text-neutral-400">
              ({used} previous {used === 1 ? "attempt" : "attempts"})
            </span>
          )}
        </div>
      )}

      {/* Meta cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetaCard
          icon={<Clock size={20} weight="duotone" />}
          label="Duration"
          value={formatDuration(duration * 60)}
        />
        <MetaCard
          icon={<Eye size={20} weight="duotone" />}
          label="Preview"
          value={preview ? "Yes" : "No"}
          highlight={preview}
        />
        <MetaCard
          icon={<ArrowsLeftRight size={20} weight="duotone" />}
          label="Switch Sections"
          value={canSwitchSections ? "Yes" : "No"}
          highlight={canSwitchSections}
        />
        {showAttempts && (
          <MetaCard
            icon={<ListChecks size={20} weight="duotone" />}
            label="Max Attempts"
            value={String(max)}
          />
        )}
      </div>

      {/* Instructions */}
      <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Info size={16} weight="duotone" className="text-primary-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Assessment Instructions
          </h2>
        </div>
        {instructions ? (
          <div
            className="prose prose-sm max-w-none text-neutral-700"
            dangerouslySetInnerHTML={{ __html: instructions }}
          />
        ) : (
          <p className="text-sm text-neutral-400 italic">
            No instructions provided for this assessment.
          </p>
        )}
      </div>
    </div>
  );
};
