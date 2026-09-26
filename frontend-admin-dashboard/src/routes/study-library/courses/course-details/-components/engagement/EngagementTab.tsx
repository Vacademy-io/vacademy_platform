import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowClockwise, Plus, Sparkle, WarningCircle } from '@phosphor-icons/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MyButton } from '@/components/design-system/button';
import { listEngagementPlans } from '@/routes/engagement/-services/engagement-service';
import { AiPlanWizard } from '@/routes/engagement/-components/AiPlanWizard';
import { PlanComposerDialog } from '@/routes/engagement/-components/PlanComposerDialog';
import { PlanCard } from '@/routes/engagement/-components/PlanCard';

/**
 * Course page → Engagement tab.
 *
 * Scoped to the batch the course page is showing, so a teacher schedules from the
 * course they are already looking at instead of re-picking it. The composer still
 * allows adding more batches — the selection is seeded, not locked.
 */
export function EngagementTab({ packageSessionId }: { packageSessionId: string }) {
    const { t } = useTranslation('engagement');
    const [composerOpen, setComposerOpen] = useState(false);
    // Bumped on every "New plan" so the composer mounts fresh: no fields, days or
    // tasks carried over from the previous plan.
    const [composerKey, setComposerKey] = useState(0);
    const openComposer = () => {
        setComposerKey((n) => n + 1);
        setComposerOpen(true);
    };
    const [aiOpen, setAiOpen] = useState(false);

    const {
        data: plans,
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: ['engagement-plans', packageSessionId],
        queryFn: () => listEngagementPlans(packageSessionId),
        enabled: Boolean(packageSessionId),
    });

    // A batch switch on the course page should not leave the previous batch's
    // composer open over the new one.
    useEffect(() => {
        setComposerOpen(false);
    }, [packageSessionId]);

    if (!packageSessionId) {
        return (
            <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
                {t('page.pickBatch')}
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold text-neutral-900">
                        {t('page.tabTitle')}
                    </h2>
                    <p className="mt-0.5 text-sm text-neutral-500">{t('page.tabSubtitle')}</p>
                </div>
                <span className="flex gap-2">
                    <MyButton type="button" buttonType="secondary" onClick={() => setAiOpen(true)}>
                        <Sparkle size={16} /> {t('page.planWithAi')}
                    </MyButton>
                    <MyButton type="button" onClick={openComposer}>
                        <Plus size={16} /> {t('page.newPlan')}
                    </MyButton>
                </span>
            </div>

            {isLoading && <div className="h-20 animate-pulse rounded-lg bg-neutral-100" />}

            {/* Before the empty state: a failed load must not read as "nothing scheduled". */}
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
                    <p className="text-sm font-medium text-neutral-900">
                        {t('page.nothingScheduled')}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                        {t('page.nothingScheduledHint')}
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {(plans ?? []).map((plan) => (
                    <PlanCard key={plan.id} plan={plan} onChanged={() => void refetch()} />
                ))}
            </div>

            <AiPlanWizard
                open={aiOpen}
                onOpenChange={setAiOpen}
                onCreated={() => void refetch()}
                defaultPackageSessionId={packageSessionId}
            />

            <PlanComposerDialog
                key={composerKey}
                open={composerOpen}
                onOpenChange={setComposerOpen}
                onCreated={() => void refetch()}
                defaultPackageSessionId={packageSessionId}
            />
        </div>
    );
}
