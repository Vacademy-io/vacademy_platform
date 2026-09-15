import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CaretDown, CaretRight, PencilSimple } from '@phosphor-icons/react';
import { getEngagementPlan } from '../-services/engagement-service';
import type { EngagementItemDTO, EngagementPlanDTO } from '../-types/types';
import { ItemTrackingDialog } from './ItemTrackingDialog';
import { PlanComposerDialog } from './PlanComposerDialog';

/**
 * One plan in the list. Collapsed it shows status; expanded it loads the plan's
 * slots and tasks, and each task opens its tracking table.
 *
 * Slots and tasks are fetched only on expand — a list of plans should not pull
 * every task in every plan just to render headers.
 */
export function PlanCard({ plan, onChanged }: { plan: EngagementPlanDTO; onChanged?: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const [trackingItem, setTrackingItem] = useState<EngagementItemDTO | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    const {
        data: detail,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['engagement-plan', plan.id],
        queryFn: () => getEngagementPlan(plan.id),
        enabled: expanded,
    });

    const slots = detail?.slots ?? [];

    return (
        <div className="rounded-lg border border-neutral-200">
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex w-full items-center gap-3 p-4 text-start transition hover:bg-neutral-50"
            >
                {expanded ? <CaretDown size={16} /> : <CaretRight size={16} />}
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-neutral-900">
                        {plan.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">
                        {plan.timezone} · {plan.defaultMissPolicy}
                    </span>
                </span>
                <span
                    className={
                        plan.status === 'PUBLISHED'
                            ? 'rounded-md bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700'
                            : 'rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600'
                    }
                >
                    {plan.status}
                </span>
                {/* A span, not a button: this sits inside the expand button, and a
                    nested button is invalid HTML. */}
                <span
                    role="button"
                    tabIndex={0}
                    aria-label="Edit plan"
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                    onClick={(e) => {
                        e.stopPropagation();
                        setEditOpen(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditOpen(true);
                        }
                    }}
                >
                    <PencilSimple size={16} />
                </span>
            </button>

            {expanded && (
                <div className="border-t border-neutral-100 p-4">
                    {isLoading && <div className="h-16 animate-pulse rounded bg-neutral-100" />}

                    {!isLoading && slots.length === 0 && (
                        <p className="text-sm text-neutral-500">
                            This plan has no scheduled slots yet.
                        </p>
                    )}

                    <div className="space-y-4">
                        {slots.map((slot) => (
                            <div key={slot.id}>
                                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                    {slot.startDate}
                                    {slot.endDate && slot.endDate !== slot.startDate
                                        ? ` – ${slot.endDate}`
                                        : ''}{' '}
                                    · {slot.startTime}–{slot.endTime}
                                    {slot.revealTime ? ` · reveal ${slot.revealTime}` : ''}
                                </p>
                                <div className="mt-2 space-y-2">
                                    {slot.items.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setTrackingItem(item)}
                                            className="flex w-full items-center gap-3 rounded-md border border-neutral-200 px-3 py-2 text-start text-sm transition hover:border-neutral-300"
                                        >
                                            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                                                {item.itemType}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-neutral-900">
                                                {item.title}
                                            </span>
                                            <span className="text-xs text-neutral-500">
                                                {item.completedCount ?? 0} completed
                                            </span>
                                        </button>
                                    ))}
                                    {slot.items.length === 0 && (
                                        <p className="text-sm text-neutral-500">No tasks.</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <PlanComposerDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                planId={plan.id}
                onCreated={() => {
                    void refetch();
                    onChanged?.();
                }}
            />

            <ItemTrackingDialog
                item={trackingItem}
                open={Boolean(trackingItem)}
                onOpenChange={(next) => {
                    if (!next) setTrackingItem(null);
                }}
            />
        </div>
    );
}
