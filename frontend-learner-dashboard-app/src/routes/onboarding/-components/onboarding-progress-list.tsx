import { StatusChip, type StatusType } from "@/components/design-system/status-chips";
import type {
  OnboardingStepInstanceDTO,
  OnboardingStepStatus,
} from "../-services/onboarding-services";

const STEP_STATUS_META: Record<
  OnboardingStepStatus,
  { label: string; status: StatusType }
> = {
  PENDING: { label: "Pending", status: "INFO" },
  IN_PROGRESS: { label: "In progress", status: "WARNING" },
  COMPLETED: { label: "Completed", status: "SUCCESS" },
  SKIPPED: { label: "Skipped", status: "INFO" },
};

interface OnboardingProgressListProps {
  stepInstances: OnboardingStepInstanceDTO[];
}

/**
 * Simple step-name + status-chip timeline — intentionally not a fancy
 * stepper/wizard visual for v1, just enough to show where the learner is in
 * the flow.
 */
export const OnboardingProgressList = ({
  stepInstances,
}: OnboardingProgressListProps) => {
  if (stepInstances.length === 0) return null;

  return (
    <ol className="flex flex-col gap-2">
      {stepInstances.map((step, index) => {
        const meta = STEP_STATUS_META[step.status] ?? STEP_STATUS_META.PENDING;
        return (
          <li
            key={step.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2"
          >
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-2xs font-medium text-neutral-500">
                {index + 1}
              </span>
              <span className="font-medium text-neutral-700">{step.step_name}</span>
            </div>
            <StatusChip text={meta.label} textSize="text-2xs" status={meta.status} />
          </li>
        );
      })}
    </ol>
  );
};
