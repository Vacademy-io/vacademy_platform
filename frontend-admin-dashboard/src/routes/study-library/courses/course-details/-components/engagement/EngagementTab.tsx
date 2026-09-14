import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { listEngagementPlans } from '@/routes/engagement/-services/engagement-service';
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
    const [composerOpen, setComposerOpen] = useState(false);

    const {
        data: plans,
        isLoading,
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
                Pick a session and level to schedule engagement for this batch.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold text-neutral-900">Daily engagement</h2>
                    <p className="mt-0.5 text-sm text-neutral-500">
                        What this batch sees on their home page — readings, a question of the day,
                        games — and how they did.
                    </p>
                </div>
                <MyButton type="button" onClick={() => setComposerOpen(true)}>
                    <Plus size={16} /> New plan
                </MyButton>
            </div>

            {isLoading && <div className="h-20 animate-pulse rounded-lg bg-neutral-100" />}

            {!isLoading && (plans?.length ?? 0) === 0 && (
                <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center">
                    <p className="text-sm font-medium text-neutral-900">Nothing scheduled yet</p>
                    <p className="mt-1 text-sm text-neutral-500">
                        Create a plan to start showing daily tasks to this batch.
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {(plans ?? []).map((plan) => (
                    <PlanCard key={plan.id} plan={plan} />
                ))}
            </div>

            <PlanComposerDialog
                open={composerOpen}
                onOpenChange={setComposerOpen}
                onCreated={() => void refetch()}
                defaultPackageSessionId={packageSessionId}
            />
        </div>
    );
}
