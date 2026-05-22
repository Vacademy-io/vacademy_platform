import { useMemo, type ReactNode } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
    Envelope,
    Phone,
    Clock,
    CaretUpDown,
    CaretUp,
    CaretDown,
    Plus,
    UserPlus,
    ArrowsClockwise,
} from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, parseHtmlToString } from '@/lib/utils';
import type { LeadProfileSummary } from '@/hooks/use-lead-profiles';
import type { LatestNoteEvent } from '@/hooks/use-latest-notes-batch';
import { LeadStatusSelect } from '@/components/shared/lead-status-select';
import { SlaDeadlineCell } from '@/components/shared/sla-deadline-cell';
import { TatStatusBadge } from '@/components/shared/tat-status-badge';
import type { LeadStatus as LeadStatusCatalogItem } from '@/hooks/use-lead-statuses';
import type { LeadCardVM } from './lead-view-model';
import type { LeadActionHandlers, LeadTier } from './lead-actions';
import { LeadAvatar } from './lead-avatar';
import { LeadInlineSelect, LEAD_TIER_OPTIONS } from './lead-inline-select';
import { LeadActionsMenu } from './lead-actions-menu';
import { LeadSourcePill } from './lead-source-pill';
import { LeadScoreBar } from './lead-score-bar';
import { LeadEmptyState } from './lead-empty-state';

/**
 * LeadTable — the premium Orbitra-style leads table: light sentence-case headers
 * with sort chevrons, airy rows, avatar + name + relative-time, contact, a
 * neutral source pill, an editable custom-status chip, lead-score bar, editable
 * tier pill, TAT / follow-up SLA deadlines, counsellor owner, a compact activity
 * line, and round mail/call/⋯ row actions revealed on hover. Purpose-built (the
 * platform MyTable can't reproduce this look) but assembled from platform
 * primitives + tokens so it stays on the design system.
 */

export type LeadSortKey = 'name' | 'status' | 'tier' | 'score' | 'submitted';
export interface LeadSortState {
    key: LeadSortKey;
    dir: 'asc' | 'desc';
}

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
    selectedKeys: Set<string>;
    onToggleKey: (key: string) => void;
    onToggleAll: () => void;
    sort: LeadSortState;
    onSortChange: (key: LeadSortKey) => void;
    hiddenColumns?: Set<string>;
    emptyState?: ReactNode;
}

interface Col {
    id: string;
    header: string;
    sortKey?: LeadSortKey;
    thClass?: string;
    show: boolean;
    /** Stops a cell click from bubbling to the row's open-side-view handler. */
    interactive?: boolean;
    render: (vm: LeadCardVM, profile?: LeadProfileSummary) => ReactNode;
}

const TIER_RANK: Record<string, number> = { HOT: 3, WARM: 2, COLD: 1 };

const relativeTime = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    if (d.toDateString() === new Date().toDateString()) return `Today at ${format(d, 'h:mm a')}`;
    return formatDistanceToNow(d, { addSuffix: true });
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
        <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm text-neutral-700" title={text}>
                    {text}
                </p>
                <p className="mt-0.5 truncate text-xs text-neutral-400">
                    {relativeTime(latest.created_at)}
                    {latest.actor_name ? ` · ${latest.actor_name}` : ''}
                </p>
            </div>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                }}
                title="Add note"
                aria-label="Add note"
                className="mt-0.5 shrink-0 rounded-full border border-neutral-200 p-1 text-neutral-400 opacity-0 transition focus-within:opacity-100 hover:border-primary-200 hover:text-primary-600 group-hover/row:opacity-100"
            >
                <Plus className="size-3.5" />
            </button>
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
    selectedKeys,
    onToggleKey,
    onToggleAll,
    sort,
    onSortChange,
    hiddenColumns,
    emptyState,
}: LeadTableProps) {
    const profOf = (vm: LeadCardVM) => (vm.userId ? profiles[vm.userId] : undefined);
    const notesOf = (vm: LeadCardVM) => (vm.userId ? notes?.[vm.userId] : undefined);

    const sortedVms = useMemo(() => {
        const arr = [...vms];
        const dir = sort.dir === 'asc' ? 1 : -1;
        arr.sort((a, b) => {
            if (sort.key === 'name') return a.name.localeCompare(b.name) * dir;
            if (sort.key === 'status') {
                return (a.leadStatus ?? '').localeCompare(b.leadStatus ?? '') * dir;
            }
            if (sort.key === 'tier') {
                const ra = TIER_RANK[(profOf(a)?.lead_tier ?? '').toUpperCase()] ?? 0;
                const rb = TIER_RANK[(profOf(b)?.lead_tier ?? '').toUpperCase()] ?? 0;
                return (ra - rb) * dir;
            }
            if (sort.key === 'score') {
                const ra = profOf(a)?.best_score ?? -1;
                const rb = profOf(b)?.best_score ?? -1;
                return (ra - rb) * dir;
            }
            const ta = a.submittedIso ? Date.parse(a.submittedIso) : 0;
            const tb = b.submittedIso ? Date.parse(b.submittedIso) : 0;
            return (ta - tb) * dir;
        });
        return arr;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vms, sort, profiles]);

    const allSelected = vms.length > 0 && vms.every((v) => selectedKeys.has(v.key));
    const someSelected = vms.some((v) => selectedKeys.has(v.key));

    const allCols: Col[] = [
        {
            id: 'name',
            header: 'Lead name',
            sortKey: 'name',
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
                            {vm.name}
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
            sortKey: 'status',
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
            sortKey: 'score',
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
            sortKey: 'tier',
            thClass: 'w-28',
            show: showOps,
            interactive: true,
            render: (vm, profile) =>
                vm.userId ? (
                    <LeadInlineSelect
                        value={profile?.lead_tier}
                        options={LEAD_TIER_OPTIONS}
                        placeholder="Set tier"
                        onChange={(t) => actions.onSetTier?.(vm.userId!, vm.name, t as LeadTier)}
                    />
                ) : (
                    <span className="text-sm text-neutral-300">—</span>
                ),
        },
        {
            id: 'reachout',
            header: 'Reach out by',
            thClass: 'min-w-36',
            show: showOps,
            render: (vm) => <SlaDeadlineCell dueAt={vm.tatDueAt} overdue={vm.tatOverdue} />,
        },
        {
            id: 'followup',
            header: 'Follow up by',
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
                            className="shrink-0 rounded-full border border-neutral-200 p-1 text-neutral-400 opacity-0 transition focus-within:opacity-100 hover:border-primary-200 hover:text-primary-600 group-hover/row:opacity-100"
                        >
                            <ArrowsClockwise className="size-3.5" />
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
                        onAdd={() => actions.onAddNote?.(vm.userId!, vm.name)}
                    />
                ) : (
                    <span className="text-sm text-neutral-300">—</span>
                ),
        },
        {
            id: 'submitted',
            header: 'Submitted',
            sortKey: 'submitted',
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
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                        <th className="w-12 px-4 py-3">
                            <Checkbox
                                checked={
                                    allSelected ? true : someSelected ? 'indeterminate' : false
                                }
                                onCheckedChange={onToggleAll}
                                aria-label="Select all"
                            />
                        </th>
                        {cols.map((c) => (
                            <th
                                key={c.id}
                                className={cn(
                                    'whitespace-nowrap px-4 py-3 text-xs font-medium text-neutral-500',
                                    c.thClass
                                )}
                            >
                                {c.sortKey ? (
                                    <button
                                        type="button"
                                        onClick={() => onSortChange(c.sortKey!)}
                                        className="inline-flex items-center gap-1 hover:text-neutral-700"
                                    >
                                        {c.header}
                                        {sort.key === c.sortKey ? (
                                            sort.dir === 'asc' ? (
                                                <CaretUp className="size-3" />
                                            ) : (
                                                <CaretDown className="size-3" />
                                            )
                                        ) : (
                                            <CaretUpDown className="size-3 text-neutral-300" />
                                        )}
                                    </button>
                                ) : (
                                    c.header
                                )}
                            </th>
                        ))}
                        <th className="w-16 px-4 py-3" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                    {isLoading
                        ? Array.from({ length: 8 }).map((_, i) => (
                              <tr key={i}>
                                  <td className="px-4 py-3.5">
                                      <Skeleton className="size-4 rounded" />
                                  </td>
                                  {cols.map((c) => (
                                      <td key={c.id} className="px-4 py-3.5">
                                          <Skeleton className="h-6 w-40" />
                                      </td>
                                  ))}
                                  <td className="px-4 py-3.5" />
                              </tr>
                          ))
                        : sortedVms.map((vm) => {
                              const profile = profOf(vm);
                              const selected = selectedKeys.has(vm.key);
                              return (
                                  <tr
                                      key={vm.key}
                                      onClick={() => actions.onOpenDetails(vm)}
                                      className={cn(
                                          'group/row cursor-pointer transition-colors',
                                          selected ? 'bg-primary-50/40' : 'hover:bg-neutral-50/60'
                                      )}
                                  >
                                      <td
                                          className="px-4 py-3.5 align-middle"
                                          onClick={(e) => e.stopPropagation()}
                                      >
                                          <Checkbox
                                              checked={selected}
                                              onCheckedChange={() => onToggleKey(vm.key)}
                                              aria-label={`Select ${vm.name}`}
                                          />
                                      </td>
                                      {cols.map((c) => (
                                          <td
                                              key={c.id}
                                              className="px-4 py-3.5 align-middle"
                                              onClick={
                                                  c.interactive
                                                      ? (e) => e.stopPropagation()
                                                      : undefined
                                              }
                                          >
                                              {c.render(vm, profile)}
                                          </td>
                                      ))}
                                      <td
                                          className="px-4 py-3.5 align-middle"
                                          onClick={(e) => e.stopPropagation()}
                                      >
                                          <div className="flex items-center justify-end">
                                              <LeadActionsMenu
                                                  vm={vm}
                                                  currentTier={profile?.lead_tier}
                                                  currentStatus={vm.leadStatus}
                                                  showOps={showOps}
                                                  actions={actions}
                                                  className="size-8 rounded-full border border-neutral-200"
                                              />
                                          </div>
                                      </td>
                                  </tr>
                              );
                          })}
                </tbody>
            </table>
        </div>
    );
}
