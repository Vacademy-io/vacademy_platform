import { createLazyFileRoute, getRouteApi } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Sparkle } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { listEngagementPlans } from './-services/engagement-service';
import { AiPlanWizard } from '@/routes/engagement/-components/AiPlanWizard';
import { PlanComposerDialog } from './-components/PlanComposerDialog';
import { PlanCard } from './-components/PlanCard';

const routeApi = getRouteApi('/engagement/');

export const Route = createLazyFileRoute('/engagement/')({
    component: EngagementPlans,
});

/** Daily engagement plans for a batch: what learners are shown, and when. */
function EngagementPlans() {
    const { packageSessionId } = routeApi.useSearch();
    const { setNavHeading } = useNavHeadingStore();
    const [composerOpen, setComposerOpen] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);

    useEffect(() => {
        setNavHeading('Daily Engagement');
    }, [setNavHeading]);

    const {
        data: plans,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['engagement-plans', packageSessionId],
        queryFn: () => listEngagementPlans(packageSessionId),
    });

    return (
        <LayoutContainer>
            <div className="space-y-6 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold text-neutral-900">Daily engagement</h1>
                        <p className="mt-1 text-sm text-neutral-500">
                            Schedule what a batch sees on their home page — readings, a question of
                            the day, games — and track how they do.
                        </p>
                    </div>
                    <span className="flex gap-2">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            onClick={() => setAiOpen(true)}
                        >
                            <Sparkle size={16} /> Plan with AI
                        </MyButton>
                        <MyButton type="button" onClick={() => setComposerOpen(true)}>
                            <Plus size={16} /> New plan
                        </MyButton>
                    </span>
                </div>

                {isLoading && (
                    <div className="space-y-3">
                        <div className="h-20 animate-pulse rounded-lg bg-neutral-100" />
                        <div className="h-20 animate-pulse rounded-lg bg-neutral-100" />
                    </div>
                )}

                {!isLoading && (plans?.length ?? 0) === 0 && (
                    <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center">
                        <p className="text-sm font-medium text-neutral-900">No plans yet</p>
                        <p className="mt-1 text-sm text-neutral-500">
                            Create one to start showing daily tasks on the learner home page.
                        </p>
                    </div>
                )}

                <div className="space-y-3">
                    {(plans ?? []).map((plan) => (
                        <PlanCard key={plan.id} plan={plan} onChanged={() => void refetch()} />
                    ))}
                </div>
            </div>

            <AiPlanWizard
                open={aiOpen}
                onOpenChange={setAiOpen}
                onCreated={() => void refetch()}
                defaultPackageSessionId={packageSessionId}
            />

            <PlanComposerDialog
                open={composerOpen}
                onOpenChange={setComposerOpen}
                onCreated={() => void refetch()}
                defaultPackageSessionId={packageSessionId}
            />
        </LayoutContainer>
    );
}
