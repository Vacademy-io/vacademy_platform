import { useQuery } from '@tanstack/react-query';
import { ArrowRight, User as UserIcon, CircleNotch } from '@phosphor-icons/react';
import { fetchLeadTransfers, type LeadTransfer } from '../-services/counsellor-workbench-services';

interface Props {
    instituteId: string;
    leadUserId: string;
}

/**
 * Mini-timeline of a single lead's counsellor-assignment chain. Renders one
 * row per timeline_event(action_type=COUNSELOR_ASSIGNED) for this lead,
 * oldest at top. Rendered inside the expanded row of CounsellorLeadsTab.
 *
 * Lazy: the query only fires when this component mounts, so collapsed rows
 * don't pay for the fetch.
 */
export function LeadTransferChain({ instituteId, leadUserId }: Props) {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['workbench-lead-transfers', instituteId, leadUserId],
        enabled: !!instituteId && !!leadUserId,
        queryFn: () => fetchLeadTransfers(instituteId, leadUserId),
        staleTime: 60_000,
    });

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-3 text-caption text-neutral-500">
                <CircleNotch size={14} className="animate-spin" />
                Loading transfer history…
            </div>
        );
    }
    if (isError) {
        const msg = (error as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
        return (
            <div className="px-3 py-3 text-caption text-danger-600">
                {msg ?? 'Could not load transfer history.'}
            </div>
        );
    }
    if (!data || data.length === 0) {
        return (
            <div className="px-3 py-3 text-caption text-neutral-500">
                No assignment history recorded for this lead yet.
            </div>
        );
    }

    return (
        <ol className="space-y-2 px-3 py-3">
            {data.map((entry, idx) => (
                <TransferRow key={`${entry.at}-${idx}`} entry={entry} initial={idx === 0} />
            ))}
        </ol>
    );
}

function TransferRow({ entry, initial }: { entry: LeadTransfer; initial: boolean }) {
    const fromLabel =
        entry.from_user_id == null
            ? 'Unassigned'
            : entry.from_name ?? `User ${entry.from_user_id.slice(0, 8)}`;
    const toLabel = entry.to_name ?? `User ${entry.to_user_id.slice(0, 8)}`;
    return (
        <li className="rounded-md border border-neutral-200 bg-white px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-body">
                <UserIcon size={14} className="text-neutral-500" />
                <span
                    className={
                        entry.from_user_id == null
                            ? 'italic text-neutral-500'
                            : 'font-medium text-neutral-700'
                    }
                >
                    {fromLabel}
                </span>
                <ArrowRight size={14} className="text-neutral-400" />
                <span className="font-medium text-neutral-900">{toLabel}</span>
                {initial && (
                    <span className="rounded bg-primary-50 px-1.5 py-0.5 text-caption font-medium text-primary-700">
                        First assignment
                    </span>
                )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-caption text-neutral-500">
                <time>{formatStamp(entry.at)}</time>
                {entry.actor_name && (
                    <span>
                        by{' '}
                        <span className="font-medium text-neutral-700">{entry.actor_name}</span>
                    </span>
                )}
                {entry.trigger && <TriggerChip trigger={entry.trigger} mode={entry.mode} />}
            </div>
        </li>
    );
}

function TriggerChip({ trigger, mode }: { trigger: string; mode: string | null }) {
    const label = humanize(trigger) + (mode ? ` · ${humanize(mode)}` : '');
    const tone =
        trigger === 'WORKBENCH_REASSIGN'
            ? 'bg-warning-50 text-warning-700'
            : 'bg-neutral-100 text-neutral-600';
    return (
        <span className={`rounded px-1.5 py-0.5 text-caption font-medium ${tone}`}>{label}</span>
    );
}

function humanize(s: string) {
    return s
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStamp(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
