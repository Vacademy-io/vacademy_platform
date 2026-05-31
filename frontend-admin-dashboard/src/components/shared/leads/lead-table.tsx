import { type ReactNode } from 'react';
import { format } from 'date-fns';
import {
    Envelope,
    Phone,
    Clock,
    Plus,
    UserPlus,
    ArrowsClockwise,
    NotePencil,
} from '@phosphor-icons/react';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, parseHtmlToString } from '@/lib/utils';
import type { LeadProfileSummary } from '@/hooks/use-lead-profiles';
import type { LatestNoteEvent } from '@/hooks/use-latest-notes-batch';
import { LeadStatusSelect } from '@/components/shared/lead-status-select';
import { SlaDeadlineCell } from '@/components/shared/sla-deadline-cell';
import { TatStatusBadge } from '@/components/shared/tat-status-badge';
import type { LeadStatus as LeadStatusCatalogItem } from '@/hooks/use-lead-statuses';
import type { LeadCardVM } from './lead-view-model';
import { truncateName } from './lead-view-model';
import type { LeadActionHandlers, LeadTier } from './lead-actions';
import { LeadAvatar } from './lead-avatar';
import { LeadInlineSelect, LEAD_TIER_OPTIONS } from './lead-inline-select';
import { LeadSourcePill } from './lead-source-pill';
import { LeadScoreBar } from './lead-score-bar';
import { LeadEmptyState } from './lead-empty-state';

/**
 * LeadTable — the premium Orbitra-style leads table: light sentence-case headers,
 * airy rows, avatar + name + relative-time, contact, a
 * neutral source pill, an editable custom-status chip, lead-score bar, editable
 * tier pill, TAT / follow-up SLA deadlines, counsellor owner, a compact activity
 * line, and round mail/call/⋯ row actions revealed on hover. Purpose-built (the
 * platform MyTable can't reproduce this look) but assembled from platform
 * primitives + tokens so it stays on the design system.
 */

/** Per-user activity-notes summary (latest events + total count). */
export interface LeadNotesSummary {
    recent: LatestNoteEvent[];
    count: number;
}

interface LeadTableProps {
    vms: LeadCardVM[];
    profiles: Record<string, LeadProfileSummary>;
    /** Per-user activity notes, keyed by user id (for the Activity column). */
    notes?: Record<string, LeadNotesSummary>;
    /** Institute's custom lead-status catalog (ids + colours for the status chip). */
    statuses?: LeadStatusCatalogItem[];
    showOps: boolean;
    showScore?: boolean;
    isLoading: boolean;
    actions: LeadActionHandlers;
    /** Called after an inline status change so the parent can refetch. */
    onStatusUpdated?: () => void;
    hiddenColumns?: Set<string>;
    emptyState?: ReactNode;
}

interface Col {
    id: string;
    header: string;
    thClass?: string;
    show: boolean;
    /** Stops a cell click from bubbling to the row's open-side-view handler. */
    interactive?: boolean;
    render: (vm: LeadCardVM, profile?: LeadProfileSummary) => ReactNode;
}

const relativeTime = (iso?: string | null) => {
    if (!iso) return '';
    // Backend serialises every Timestamp as a bare ISO string with NO timezone
    // marker (the raw DB wall-clock value). The convention here is to treat that
    // value as UTC and convert to the browser's local timezone for display, so
    // an IST user sees the right wall-clock for a row stored in UTC.
    const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/i.test(iso);
    const normalized = hasTimezone ? iso : `${iso.replace(' ', 'T')}Z`;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return '';
    // Always show an absolute date + clock — never "X hours ago" or "Today at …" —
    // so the lead-name subtitle / activity timestamp are unambiguous at a glance.
    // Year suffix only when it differs from today (e.g. "12 Aug 2025, 4:30 PM").
    const isCurrentYear = d.getFullYear() === new Date().getFullYear();
    return format(d, isCurrentYear ? 'd MMM, h:mm a' : 'd MMM yyyy, h:mm a');
};

/** Compact, premium one-line activity cell (latest note + add affordance). */
function ActivityCell({ summary, onAdd }: { summary?: LeadNotesSummary; onAdd: () => void }) {
    const latest = summary?.recent?.[0];
    if (!latest) {
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                }}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500 transition-colors hover:border-primary-300 hover:text-primary-600"
            >
                <Plus className="size-3.5" />
                Add note
            </button>
        );
    }
    // Notes may be rich text (HTML) — show a clean plain-text preview so the
    // counsellor reads the actual note, not just the generic "Note" label.
    const raw = latest.description ?? '';
    const body = (/<\/?[a-z][^>]*>/i.test(raw) ? parseHtmlToString(raw) : raw).trim();
    const text = body || latest.title;
    return (
        <div className="min-w-0">
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="group/note block w-full rounded text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                        title="Click to view the full note"
                    >
                        <p className="line-clamp-2 text-sm text-neutral-700 group-hover/note:text-primary-700">
                            {text}
                        </p>
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    className="w-96 max-w-md p-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header — author + meta */}
                    <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
                        <LeadAvatar name={latest.actor_name ?? 'A'} size="sm" />
                        <div className="min-w-0 flex-1">
                            <p
                                className="truncate text-sm font-semibold text-neutral-900"
                                title={latest.actor_name ?? 'Unknown'}
                            >
                                {latest.actor_name || 'Unknown'}
                            </p>
                            <p className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                                <span className="inline-flex items-center gap-1">
                                    <NotePencil weight="fill" className="size-3 text-neutral-400" />
                                    {latest.title || 'Note'}
                                </span>
                                <span className="text-neutral-300">·</span>
                                <span>{relativeTime(latest.created_at)}</span>
                            </p>
                        </div>
                    </div>
                    {/* Body */}
                    <div className="max-h-72 overflow-y-auto px-4 py-3">
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-800">
                            {text}
                        </p>
                    </div>
                </PopoverContent>
            </Popover>
            <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-neutral-400">
                    {relativeTime(latest.created_at)}
                </span>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAdd();
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2 py-0.5 text-xs text-neutral-500 opacity-0 transition focus-within:opacity-100 hover:border-primary-300 hover:text-primary-600 group-hover/row:opacity-100"
                >
                    <Plus className="size-3" />
                    Add note
                </button>
            </div>
        </div>
    );
}

export function LeadTable({
    vms,
    profiles,
    notes,
    statuses,
    showOps,
    showScore = false,
    isLoading,
    actions,
    onStatusUpdated,
    hiddenColumns,
    emptyState,
}: LeadTableProps) {
    const profOf = (vm: LeadCardVM) => (vm.userId ? profiles[vm.userId] : undefined);
    const notesOf = (vm: LeadCardVM) => (vm.userId ? notes?.[vm.userId] : undefined);

    const allCols: Col[] = [
        {
            id: 'name',
            header: 'Lead name',
            thClass: 'min-w-56',
            show: true,
            render: (vm) => (
                <div className="flex items-center gap-2.5">
                    <LeadAvatar name={vm.name} size="md" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                actions.onOpenDetails(vm);
                            }}
                            className="truncate text-left text-sm font-semibold text-neutral-900 hover:text-primary-600"
                            title={vm.name}
                        >
                            {truncateName(vm.name)}
                        </button>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {vm.submittedIso && (
                                <span className="flex items-center gap-1 text-xs text-neutral-400">
                                    <Clock className="size-3 shrink-0" />
                                    {relativeTime(vm.submittedIso)}
                                </span>
                            )}
                            <TatStatusBadge
                                tatOverdue={vm.tatOverdue}
                                tatDueSoon={vm.tatDueSoon}
                                followUpOverdue={vm.followUpOverdue}
                            />
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: 'contact',
            header: 'Contact',
            thClass: 'min-w-48',
            show: true,
            render: (vm) => {
                const showEmail = vm.email !== '-' && vm.email !== vm.name;
                const showPhone = vm.phone !== '-';
                if (!showEmail && !showPhone)
                    return <span className="text-sm text-neutral-300">—</span>;
                return (
                    <div className="min-w-0 space-y-1">
                        {showEmail && (
                            <p
                                className="flex items-center gap-1.5 truncate text-sm text-neutral-600"
                                title={vm.email}
                            >
                                <Envelope className="size-3.5 shrink-0 text-neutral-400" />
                                <span className="truncate">{vm.email}</span>
                            </p>
                        )}
                        {showPhone && (
                            <p className="flex items-center gap-1.5 truncate text-sm text-neutral-600">
                                <Phone className="size-3.5 shrink-0 text-neutral-400" />
                                <span className="truncate">{vm.phone}</span>
                            </p>
                        )}
                    </div>
                );
            },
        },
        {
            id: 'source',
            header: 'Lead source',
            thClass: 'min-w-32',
            show: true,
            render: (vm) => <LeadSourcePill label={vm.audience} />,
        },
        {
            id: 'status',
            header: 'Lead status',
            thClass: 'w-40',
            show: showOps,
            interactive: true,
            render: (vm) => (
                <LeadStatusSelect
                    responseId={vm.responseId}
                    currentStatus={vm.leadStatus}
                    statuses={statuses ?? []}
                    onUpdated={onStatusUpdated}
                />
            ),
        },
        {
            id: 'score',
            header: 'Lead score',
            thClass: 'w-44',
            show: showScore,
            interactive: true,
            render: (vm, profile) => {
                if (!vm.userId || profile?.best_score == null)
                    return <span className="text-sm text-neutral-300">—</span>;
                return <LeadScoreBar score={profile.best_score} />;
            },
        },
        {
            id: 'tier',
            header: 'Tier',
            thClass: 'w-28',
            show: showOps,
            interactive: true,
            render: (vm, profile) => {
                if (!vm.userId) return <span className="text-sm text-neutral-300">—</span>;
                const explicitTier = profile?.lead_tier;
                const derivedTier =
                    !explicitTier && profile?.best_score != null
                        ? profile.best_score >= 80
                            ? 'HOT'
                            : profile.best_score >= 50
                              ? 'WARM'
                              : 'COLD'
                        : undefined;
                return (
                    <LeadInlineSelect
                        value={explicitTier ?? derivedTier}
                        options={LEAD_TIER_OPTIONS}
                        placeholder="Set tier"
                        onChange={(t) => actions.onSetTier?.(vm.userId!, vm.name, t as LeadTier)}
                    />
                );
            },
        },
        {
            id: 'reachout',
            header: 'Reach out in',
            thClass: 'min-w-36',
            show: showOps,
            render: (vm) => (
                <SlaDeadlineCell
                    mode="response"
                    dueAt={vm.tatDueAt}
                    overdue={vm.tatOverdue}
                    respondedAt={vm.firstResponseAt}
                    baselineAt={vm.submittedIso}
                />
            ),
        },
        {
            id: 'followup',
            header: 'Follow up at',
            thClass: 'min-w-36',
            show: showOps,
            render: (vm) => (
                <SlaDeadlineCell dueAt={vm.followUpDueAt} overdue={vm.followUpOverdue} />
            ),
        },
        {
            id: 'owner',
            header: 'Lead owner',
            thClass: 'min-w-44',
            show: showOps,
            interactive: true,
            render: (vm, profile) => {
                if (!vm.userId) return <span className="text-sm text-neutral-300">—</span>;
                const owner = profile?.assigned_counselor_name;
                if (!owner) {
                    return (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                actions.onAssignCounsellor?.(vm.userId!, vm.name);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500 transition-colors hover:border-primary-300 hover:text-primary-600"
                        >
                            <UserPlus className="size-3.5" />
                            Assign
                        </button>
                    );
                }
                return (
                    <div className="flex items-center gap-2">
                        <LeadAvatar name={owner} size="sm" />
                        <span
                            className="min-w-0 flex-1 truncate text-sm text-neutral-800"
                            title={owner}
                        >
                            {owner}
                        </span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                actions.onAssignCounsellor?.(vm.userId!, vm.name);
                            }}
                            title="Reassign counsellor"
                            aria-label="Reassign counsellor"
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 opacity-0 transition focus-within:opacity-100 hover:bg-primary-50 hover:text-primary-600 group-hover/row:opacity-100"
                        >
                            <ArrowsClockwise className="size-4" />
                        </button>
                    </div>
                );
            },
        },
        {
            id: 'activity',
            header: 'Activity',
            thClass: 'min-w-56',
            show: showOps,
            interactive: true,
            render: (vm) =>
                vm.userId ? (
                    <ActivityCell
                        summary={notesOf(vm)}
                        onAdd={() => actions.onAddNote?.(vm.userId!, vm.name, vm.responseId)}
                    />
                ) : (
                    <span className="text-sm text-neutral-300">—</span>
                ),
        },
        {
            id: 'submitted',
            header: 'Submitted',
            thClass: 'min-w-32',
            show: true,
            render: (vm) => (
                <span className="whitespace-nowrap text-sm text-neutral-600">
                    {vm.submittedIso
                        ? format(new Date(vm.submittedIso), 'MMM d, yyyy')
                        : vm.submittedDisplay}
                </span>
            ),
        },
    ];

    const cols = allCols.filter((c) => c.show && !hiddenColumns?.has(c.id));

    if (!isLoading && vms.length === 0) {
        return <>{emptyState ?? <LeadEmptyState />}</>;
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
                <thead>
                    <tr className="border-b border-neutral-200 bg-primary-50 text-left">
                        {cols.map((c) => (
                            <th
                                key={c.id}
                                className={cn(
                                    'whitespace-nowrap border-r border-neutral-200 px-4 py-3 text-xs font-semibold text-neutral-600 last:border-r-0',
                                    c.id === 'name' &&
                                        'sticky left-0 z-20 border-r border-neutral-200 bg-primary-50',
                                    c.thClass
                                )}
                            >
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                    {isLoading
                        ? Array.from({ length: 8 }).map((_, i) => (
                              <tr key={i}>
                                  {cols.map((c) => (
                                      <td
                                          key={c.id}
                                          className={cn(
                                              'border-r border-neutral-100 px-4 py-3.5 last:border-r-0',
                                              c.id === 'name' &&
                                                  'sticky left-0 z-10 border-r border-neutral-200 bg-white'
                                          )}
                                      >
                                          <Skeleton className="h-6 w-40" />
                                      </td>
                                  ))}
                              </tr>
                          ))
                        : vms.map((vm) => {
                              const profile = profOf(vm);
                              return (
                                  <tr
                                      key={vm.key}
                                      onClick={() => actions.onOpenDetails(vm)}
                                      className="group/row cursor-pointer transition-colors hover:bg-neutral-50"
                                  >
                                      {cols.map((c) => (
                                          <td
                                              key={c.id}
                                              className={cn(
                                                  'border-r border-neutral-100 px-4 py-3.5 align-middle last:border-r-0',
                                                  c.id === 'name' &&
                                                      'sticky left-0 z-10 border-r border-neutral-200 bg-white group-hover/row:bg-neutral-50'
                                              )}
                                              onClick={
                                                  c.interactive
                                                      ? (e) => e.stopPropagation()
                                                      : undefined
                                              }
                                          >
                                              {c.render(vm, profile)}
                                          </td>
                                      ))}
                                  </tr>
                              );
                          })}
                </tbody>
            </table>
        </div>
    );
}
