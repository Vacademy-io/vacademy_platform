import { type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash, CalendarBlank, CalendarCheck } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
    deleteCounsellorTarget,
    fetchCounsellorTargets,
    fetchTargetProgress,
    TARGET_METRIC_LABEL,
    type CounsellorTarget,
} from '../../-services/counsellor-target-services';
import { TargetProgress } from './target-progress';

const PERIOD_LABEL: Record<string, string> = {
    WEEK: 'Weekly',
    MONTH: 'Monthly',
    CUSTOM: 'Custom',
};

/**
 * Per-counsellor Targets tab for the detail drawer: current week + month
 * progress up top, then the full list of configured targets (all periods) with
 * a remove action. Adding/updating values is done from the roster's
 * "Set targets" dialog (per-person rows), so this stays a focused detail view.
 */
export function CounsellorTargetsTab({
    instituteId,
    counsellorUserId,
}: {
    instituteId: string;
    counsellorUserId: string;
}) {
    const queryClient = useQueryClient();
    const ids = [counsellorUserId];

    const targetsQuery = useQuery({
        queryKey: ['counsellor-targets', instituteId, counsellorUserId],
        enabled: !!instituteId && !!counsellorUserId,
        queryFn: () => fetchCounsellorTargets(instituteId, counsellorUserId),
    });

    const weekQuery = useQuery({
        queryKey: ['counsellor-target-progress-one', instituteId, counsellorUserId, 'WEEK'],
        enabled: !!instituteId && !!counsellorUserId,
        staleTime: 60_000,
        queryFn: () =>
            fetchTargetProgress({
                institute_id: instituteId,
                counsellor_user_ids: ids,
                period_type: 'WEEK',
            }),
    });
    const monthQuery = useQuery({
        queryKey: ['counsellor-target-progress-one', instituteId, counsellorUserId, 'MONTH'],
        enabled: !!instituteId && !!counsellorUserId,
        staleTime: 60_000,
        queryFn: () =>
            fetchTargetProgress({
                institute_id: instituteId,
                counsellor_user_ids: ids,
                period_type: 'MONTH',
            }),
    });

    const removeMutation = useMutation({
        mutationFn: (targetId: string) =>
            deleteCounsellorTarget(targetId, instituteId, counsellorUserId),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['counsellor-targets', instituteId, counsellorUserId],
            });
            queryClient.invalidateQueries({ queryKey: ['counsellor-target-progress-one'] });
            queryClient.invalidateQueries({ queryKey: ['counsellor-target-progress'] });
            toast.success('Target removed');
        },
        onError: (e) =>
            toast.error(
                (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex ??
                    'Could not remove target'
            ),
    });

    const weekItems = weekQuery.data?.rows?.[0]?.items;
    const monthItems = monthQuery.data?.rows?.[0]?.items;
    const targets = targetsQuery.data ?? [];

    return (
        <div className="flex flex-col gap-5">
            {/* Current progress */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ProgressCard
                    title="This week"
                    icon={<CalendarBlank size={14} />}
                    items={weekItems}
                    loading={weekQuery.isLoading}
                />
                <ProgressCard
                    title="This month"
                    icon={<CalendarCheck size={14} />}
                    items={monthItems}
                    loading={monthQuery.isLoading}
                />
            </div>

            {/* Configured targets */}
            <div>
                <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-neutral-500">
                    Configured targets
                </div>
                {targetsQuery.isLoading ? (
                    <div className="rounded-md border border-neutral-200 bg-white p-4 text-caption text-neutral-400">
                        Loading…
                    </div>
                ) : targets.length === 0 ? (
                    <div className="rounded-md border border-dashed border-neutral-300 bg-white p-4 text-caption text-neutral-400">
                        No targets set. Use “Set targets” on the counsellors list to add one.
                    </div>
                ) : (
                    <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
                        {targets.map((t) => (
                            <TargetRow
                                key={t.id}
                                target={t}
                                onRemove={() => removeMutation.mutate(t.id)}
                                removing={
                                    removeMutation.isPending && removeMutation.variables === t.id
                                }
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function ProgressCard({
    title,
    icon,
    items,
    loading,
}: {
    title: string;
    icon: ReactNode;
    items: Parameters<typeof TargetProgress>[0]['items'];
    loading: boolean;
}) {
    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-1.5 text-caption font-medium text-neutral-600">
                <span className="text-neutral-400">{icon}</span>
                {title}
            </div>
            <TargetProgress items={items} loading={loading} />
        </div>
    );
}

function TargetRow({
    target,
    onRemove,
    removing,
}: {
    target: CounsellorTarget;
    onRemove: () => void;
    removing: boolean;
}) {
    const period =
        target.period_type === 'CUSTOM'
            ? `${target.period_start} → ${target.period_end}`
            : PERIOD_LABEL[target.period_type];
    return (
        <li className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
                <div className="text-body font-medium text-neutral-900">
                    {TARGET_METRIC_LABEL[target.metric]}
                    <span className="ml-2 text-caption font-normal text-neutral-500">{period}</span>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-body font-semibold tabular-nums text-neutral-900">
                    {target.target_value}
                </span>
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={removing}
                    title="Remove target"
                    aria-label="Remove target"
                    className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
                >
                    <Trash size={16} />
                </button>
            </div>
        </li>
    );
}
