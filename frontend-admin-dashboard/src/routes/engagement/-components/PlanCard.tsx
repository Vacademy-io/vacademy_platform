import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
    ArrowClockwise,
    CaretDown,
    CaretRight,
    PencilSimple,
    ChartBar,
    Trash,
    EyeSlash,
    Eye,
    WarningCircle,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { StatusChip, type StatusType } from '@/components/design-system/status-chips';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
    deleteEngagementPlan,
    getEngagementPlan,
    updateEngagementPlan,
} from '../-services/engagement-service';
import { PlanOverviewDialog } from './PlanOverviewDialog';
import type { EngagementItemDTO, EngagementPlanDTO, PlanStatus } from '../-types/types';
import { ItemTrackingDialog } from './ItemTrackingDialog';
import { PlanComposerDialog } from './PlanComposerDialog';

const STATUS_TONE: Record<PlanStatus, StatusType> = {
    PUBLISHED: 'SUCCESS',
    DRAFT: 'INFO',
    ARCHIVED: 'INFO',
    DELETED: 'DANGER',
};

/** The server's own message when it sent one, else the caller's fallback. */
function errorMessage(e: unknown, fallback: string): string {
    return (
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
    );
}

const ICON_BUTTON = 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900';

/**
 * One plan in the list. Collapsed it shows status; expanded it loads the plan's
 * slots and tasks, and each task opens its tracking table.
 *
 * Slots and tasks are fetched only on expand — a list of plans should not pull
 * every task in every plan just to render headers.
 */
export function PlanCard({ plan, onChanged }: { plan: EngagementPlanDTO; onChanged?: () => void }) {
    const { t } = useTranslation('engagement');
    const [expanded, setExpanded] = useState(false);
    const [trackingItem, setTrackingItem] = useState<EngagementItemDTO | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [overviewOpen, setOverviewOpen] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [busy, setBusy] = useState(false);

    const isPublished = plan.status === 'PUBLISHED';

    async function togglePublished() {
        setBusy(true);
        try {
            await updateEngagementPlan(plan.id, {
                status: isPublished ? 'DRAFT' : 'PUBLISHED',
            });
            toast.success(isPublished ? t('card.hidden') : t('card.shown'));
            onChanged?.();
        } catch (e: unknown) {
            toast.error(errorMessage(e, t('card.toggleError')));
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        setBusy(true);
        try {
            await deleteEngagementPlan(plan.id);
            toast.success(t('card.removed'));
            setConfirmRemove(false);
            onChanged?.();
        } catch (e: unknown) {
            toast.error(errorMessage(e, t('card.removeError')));
        } finally {
            setBusy(false);
        }
    }

    const {
        data: detail,
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: ['engagement-plan', plan.id],
        queryFn: () => getEngagementPlan(plan.id),
        enabled: expanded,
    });

    const slots = detail?.slots ?? [];
    const detailId = `engagement-plan-${plan.id}`;

    return (
        <div className="rounded-lg border border-neutral-200">
            <div className="flex items-center gap-2 p-2 pe-3">
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    aria-expanded={expanded}
                    aria-controls={detailId}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 text-start transition hover:bg-neutral-50"
                >
                    {expanded ? <CaretDown size={16} /> : <CaretRight size={16} />}
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-900">
                            {plan.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-neutral-500">
                            {plan.timezone} · {t(`composer.miss.${plan.defaultMissPolicy}`)}
                        </span>
                    </span>
                </button>
                <StatusChip
                    text={t(`card.status.${plan.status}`)}
                    textSize="text-caption"
                    status={STATUS_TONE[plan.status] ?? 'INFO'}
                    showIcon={false}
                />
                <MyButton
                    type="button"
                    buttonType="text"
                    layoutVariant="icon"
                    aria-label={t('card.progress')}
                    title={t('card.progressTitle')}
                    className={ICON_BUTTON}
                    onClick={() => setOverviewOpen(true)}
                >
                    <ChartBar size={16} />
                </MyButton>
                <MyButton
                    type="button"
                    buttonType="text"
                    layoutVariant="icon"
                    aria-label={isPublished ? t('card.unpublish') : t('card.publish')}
                    title={isPublished ? t('card.hide') : t('card.show')}
                    disable={busy}
                    className={ICON_BUTTON}
                    onClick={() => void togglePublished()}
                >
                    {isPublished ? <EyeSlash size={16} /> : <Eye size={16} />}
                </MyButton>
                <MyButton
                    type="button"
                    buttonType="text"
                    layoutVariant="icon"
                    aria-label={t('card.remove')}
                    title={t('card.remove')}
                    disable={busy}
                    className={cn(ICON_BUTTON, 'hover:bg-danger-50 hover:text-danger-600')}
                    onClick={() => setConfirmRemove(true)}
                >
                    <Trash size={16} />
                </MyButton>
                <MyButton
                    type="button"
                    buttonType="text"
                    layoutVariant="icon"
                    aria-label={t('card.edit')}
                    title={t('card.edit')}
                    className={ICON_BUTTON}
                    onClick={() => setEditOpen(true)}
                >
                    <PencilSimple size={16} />
                </MyButton>
            </div>

            {expanded && (
                <div id={detailId} className="border-t border-neutral-100 p-4">
                    {isLoading && <div className="h-16 animate-pulse rounded bg-neutral-100" />}

                    {isError && (
                        <Alert className="border-danger-200 bg-danger-50 text-danger-700">
                            <div className="flex flex-wrap items-center gap-3">
                                <WarningCircle size={18} className="shrink-0" />
                                <AlertDescription className="min-w-0 flex-1">
                                    {t('card.loadError')}
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

                    {!isLoading && !isError && slots.length === 0 && (
                        <p className="text-sm text-neutral-500">{t('card.noSlots')}</p>
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
                                    {slot.revealTime
                                        ? ` · ${t('card.reveal', { time: slot.revealTime })}`
                                        : ''}
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
                                                {t(`composer.types.${item.itemType}`)}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-neutral-900">
                                                {item.title}
                                            </span>
                                            <span className="text-xs text-neutral-500">
                                                {t('card.completed', {
                                                    count: item.completedCount ?? 0,
                                                })}
                                            </span>
                                        </button>
                                    ))}
                                    {slot.items.length === 0 && (
                                        <p className="text-sm text-neutral-500">
                                            {t('card.noTasks')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Removing a plan takes it off every learner's home page; the attempts and
                points already earned are untouched. */}
            <AlertDialog
                open={confirmRemove}
                onOpenChange={(next) => {
                    if (!busy) setConfirmRemove(next);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-start">
                            {t('card.removeTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-start">
                            {t('card.removeConfirm', { title: plan.title })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>{t('card.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={busy}
                            className="bg-danger-600 hover:bg-danger-500"
                            onClick={(e) => {
                                // Keep the dialog open until the delete settles, so a
                                // failure is reported while the teacher is still here.
                                e.preventDefault();
                                void remove();
                            }}
                        >
                            {busy ? t('card.removing') : t('card.remove')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <PlanComposerDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                planId={plan.id}
                onCreated={() => {
                    void refetch();
                    onChanged?.();
                }}
            />

            <PlanOverviewDialog
                planId={plan.id}
                open={overviewOpen}
                onOpenChange={setOverviewOpen}
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
