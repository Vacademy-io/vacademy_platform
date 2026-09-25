import { createLazyFileRoute, getRouteApi } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowClockwise, Plus, Sparkle, WarningCircle } from '@phosphor-icons/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
    const { t } = useTranslation('engagement');
    const { packageSessionId } = routeApi.useSearch();
    const { setNavHeading } = useNavHeadingStore();
    const [composerOpen, setComposerOpen] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);

    useEffect(() => {
        setNavHeading(t('page.title'));
    }, [setNavHeading, t]);

    const {
        data: plans,
        isLoading,
        isError,
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
                        <h1 className="text-xl font-semibold text-neutral-900">
                            {t('page.title')}
                        </h1>
                        <p className="mt-1 text-sm text-neutral-500">{t('page.subtitle')}</p>
                    </div>
                    <span className="flex gap-2">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            onClick={() => setAiOpen(true)}
                        >
                            <Sparkle size={16} /> {t('page.planWithAi')}
                        </MyButton>
                        <MyButton type="button" onClick={() => setComposerOpen(true)}>
                            <Plus size={16} /> {t('page.newPlan')}
                        </MyButton>
                    </span>
                </div>

                {isLoading && (
                    <div className="space-y-3">
                        <div className="h-20 animate-pulse rounded-lg bg-neutral-100" />
                        <div className="h-20 animate-pulse rounded-lg bg-neutral-100" />
                    </div>
                )}

                {/* Before the empty state: a failed load must not read as "no plans". */}
                {isError && (
                    <Alert className="border-danger-200 bg-danger-50 text-danger-700">
                        <div className="flex flex-wrap items-center gap-3">
                            <WarningCircle size={18} className="shrink-0" />
                            <AlertDescription className="min-w-0 flex-1">
                                {t('page.loadError')}
                            </AlertDescription>
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                onClick={() => void refetch()}
                            >
                                <ArrowClockwise size={14} /> {t('common.retry')}
                            </MyButton>
                        </div>
                    </Alert>
                )}

                {!isLoading && !isError && (plans?.length ?? 0) === 0 && (
                    <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center">
                        <p className="text-sm font-medium text-neutral-900">{t('page.noPlans')}</p>
                        <p className="mt-1 text-sm text-neutral-500">{t('page.noPlansHint')}</p>
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
