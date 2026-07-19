import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  ClipboardText,
  SpinnerGap,
  Warning,
} from "@phosphor-icons/react";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { ModernCard } from "@/components/design-system/modern-card";
import { getInstituteId } from "@/constants/helper";
import {
  ONBOARDING_INSTANCES_QUERY_KEY,
  OnboardingStepForm,
} from "./-components/onboarding-step-form";
import { OnboardingProgressList } from "./-components/onboarding-progress-list";
import {
  getMyOnboardingInstances,
  type OnboardingInstanceDTO,
  type OnboardingStepInstanceDTO,
} from "./-services/onboarding-services";

export const Route = createFileRoute("/onboarding/")({
  component: () => (
    <LayoutContainer>
      <OnboardingPage />
    </LayoutContainer>
  ),
});

/** The step the learner should act on next, if any (FORM steps only in v1).
 *  A current step the caller can't act on (e.g. a create_student step, always
 *  admin-only) is skipped here rather than rendered as a dead-end form the
 *  learner can't actually submit. */
const getActiveFormStep = (
  instance: OnboardingInstanceDTO
): OnboardingStepInstanceDTO | null => {
  if (instance.status !== "IN_PROGRESS") return null;
  const current =
    instance.step_instances.find((s) => s.id === instance.current_step_id) ??
    instance.step_instances.find((s) => s.status === "IN_PROGRESS");
  if (!current) return null;
  if (current.status !== "IN_PROGRESS" && current.status !== "PENDING") return null;
  if (current.step_type !== "FORM") return null;
  if (current.learner_can_act === false) return null;
  return current;
};

function OnboardingPage() {
  const { setNavHeading } = useNavHeadingStore();
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [isResolvingInstitute, setIsResolvingInstitute] = useState(true);

  useEffect(() => {
    setNavHeading("Onboarding");
  }, [setNavHeading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getInstituteId();
      if (!cancelled) {
        setInstituteId(id ?? null);
        setIsResolvingInstitute(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    data: instances,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [ONBOARDING_INSTANCES_QUERY_KEY, instituteId],
    queryFn: () => getMyOnboardingInstances(instituteId as string),
    enabled: Boolean(instituteId),
    staleTime: 30 * 1000,
  });

  const isLoadingAny = isResolvingInstitute || (Boolean(instituteId) && isLoading);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-1 py-4">
      <div>
        <h1 className="text-h3 font-semibold text-neutral-700">Onboarding</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Complete the steps below to finish your onboarding.
        </p>
      </div>

      {isLoadingAny ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <SpinnerGap className="size-5 animate-spin" />
          Loading your onboarding status...
        </div>
      ) : isError ? (
        <ModernCard
          variant="outlined"
          padding="lg"
          rounded="lg"
          className="flex flex-col items-center gap-3 text-center"
        >
          <Warning className="size-8 text-danger-500" />
          <p className="text-sm text-neutral-600">
            We couldn&apos;t load your onboarding status. Please try again.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm font-medium text-primary-500 hover:underline"
          >
            Retry
          </button>
        </ModernCard>
      ) : !instances || instances.length === 0 ? (
        <ModernCard
          variant="subtle"
          padding="lg"
          rounded="lg"
          className="flex flex-col items-center gap-3 py-10 text-center"
        >
          <ClipboardText className="size-8 text-neutral-400" />
          <p className="text-sm text-neutral-600">
            Nothing to complete right now.
          </p>
        </ModernCard>
      ) : (
        instances.map((instance) => (
          <OnboardingInstanceCard key={instance.id} instance={instance} />
        ))
      )}
    </div>
  );
}

interface OnboardingInstanceCardProps {
  instance: OnboardingInstanceDTO;
}

function OnboardingInstanceCard({ instance }: OnboardingInstanceCardProps) {
  const activeStep = getActiveFormStep(instance);

  return (
    <div className="flex flex-col gap-4">
      {/* Only set when this is a linked child's instance, not the caller's own —
          lets a parent with multiple children tell their cards apart. */}
      {instance.subject_full_name && (
        <p className="text-sm font-medium text-neutral-600">
          Onboarding for {instance.subject_full_name}
        </p>
      )}
      {activeStep ? (
        <OnboardingStepForm
          stepInstance={activeStep}
          onSubmitted={() => {
            /* Query invalidation inside OnboardingStepForm refetches
               instances; the next active step (if any) renders from the
               refreshed data automatically. */
          }}
        />
      ) : instance.status === "COMPLETED" ? (
        <ModernCard
          variant="glass"
          padding="lg"
          rounded="lg"
          className="flex items-center gap-3 border border-white/40 bg-white/90"
        >
          <CheckCircle className="size-6 shrink-0 text-success-600" weight="fill" />
          <p className="text-sm text-neutral-600">
            This onboarding flow is complete. Nothing else to do here.
          </p>
        </ModernCard>
      ) : (
        <ModernCard
          variant="glass"
          padding="lg"
          rounded="lg"
          className="flex items-center gap-3 border border-white/40 bg-white/90"
        >
          <CheckCircle className="size-6 shrink-0 text-neutral-400" />
          <p className="text-sm text-neutral-600">
            No action needed from you right now for this step.
          </p>
        </ModernCard>
      )}

      <ModernCard variant="outlined" padding="md" rounded="lg">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Progress
        </p>
        <OnboardingProgressList stepInstances={instance.step_instances} />
      </ModernCard>
    </div>
  );
}
