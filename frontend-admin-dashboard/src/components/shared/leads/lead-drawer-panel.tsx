import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import {
    CaretLeft,
    CaretRight,
    Lightning,
    NotePencil,
    Phone,
    Robot,
    UserPlus,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useLeadStatuses } from '@/hooks/use-lead-statuses';
import { TatStatusBadge } from '@/components/shared/tat-status-badge';
import { LeadStageChip } from './lead-stage-chip';
import { LeadScoreBar } from './lead-score-bar';
import { useLeadDrawerSourceStore } from './lead-drawer-source';
import type { LeadCardVM } from './lead-view-model';
import type { LeadProfileSummary } from '@/hooks/use-lead-profiles';
import type { LeadActionHandlers } from './lead-actions';

const parseIso = (iso?: string | null): Date | null => {
    if (!iso) return null;
    const hasTz = /Z$|[+-]\d{2}:?\d{2}$/i.test(iso);
    const d = new Date(hasTz ? iso : `${iso.replace(' ', 'T')}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
};
const relative = (iso?: string | null) => {
    const d = parseIso(iso);
    return d ? formatDistanceToNow(d, { addSuffix: true }) : '';
};

type NbaAction = 'call' | 'assign' | 'note';
interface Nba {
    key: string;
    title: string;
    text: string;
    action: NbaAction;
    tone: 'danger' | 'warning' | 'primary' | 'neutral';
}

/** One suggestion, worst problem first, from data the row already has. */
function nextBestAction(
    vm: LeadCardVM,
    profile: LeadProfileSummary | undefined,
    canAssign: boolean,
    t: (k: string, o?: Record<string, unknown>) => string
): Nba {
    if (vm.slaClosed) {
        return {
            key: 'closed',
            title: t('drawer.nba.closed.title'),
            text: t('drawer.nba.closed.text'),
            action: 'note',
            tone: 'neutral',
        };
    }
    if (profile && !profile.assigned_counselor_id && canAssign) {
        return {
            key: 'assign',
            title: t('drawer.nba.assign.title'),
            text: t('drawer.nba.assign.text'),
            action: 'assign',
            tone: 'warning',
        };
    }
    if (vm.followUpOverdue) {
        return {
            key: 'followUpOverdue',
            title: t('drawer.nba.followUpOverdue.title'),
            text: t('drawer.nba.followUpOverdue.text', { when: relative(vm.followUpDueAt) }),
            action: 'call',
            tone: 'danger',
        };
    }
    if (!vm.firstResponseAt) {
        return {
            key: 'firstCall',
            title: vm.tatOverdue
                ? t('drawer.nba.firstCallLate.title')
                : t('drawer.nba.firstCall.title'),
            text: vm.tatDueAt
                ? t('drawer.nba.firstCall.text', { when: relative(vm.tatDueAt) })
                : t('drawer.nba.firstCall.textNoDue'),
            action: 'call',
            tone: vm.tatOverdue ? 'danger' : 'primary',
        };
    }
    if (vm.followUpDueAt) {
        return {
            key: 'followUp',
            title: t('drawer.nba.followUp.title', { when: relative(vm.followUpDueAt) }),
            text: t('drawer.nba.followUp.text'),
            action: 'call',
            tone: 'primary',
        };
    }
    return {
        key: 'schedule',
        title: t('drawer.nba.schedule.title'),
        text: t('drawer.nba.schedule.text'),
        action: 'note',
        tone: 'neutral',
    };
}

const NBA_TONE: Record<Nba['tone'], string> = {
    danger: 'border-danger-200 bg-danger-50',
    warning: 'border-warning-200 bg-warning-50',
    primary: 'border-primary-200 bg-primary-50',
    neutral: 'border-neutral-200 bg-neutral-50',
};

/**
 * Lead side panel: Previous / Next through the rows on the page it was opened from, status,
 * stage and SLA chips, owner, a "next best action" and a grid of quick actions. Every
 * action is the page's own handler, so it behaves exactly like the row's buttons.
 * Hidden for anything that is not a lead row from a leads page.
 */
export function LeadDrawerPanel({ responseId }: { responseId: string | null }) {
    const source = useLeadDrawerSourceStore((s) => s.source);
    if (!responseId || !source) return null;
    const idx = source.vms.findIndex((v) => v.responseId === responseId);
    if (idx < 0) return null;
    return <PanelBody idx={idx} {...source} />;
}

function PanelBody({
    idx,
    vms,
    profiles,
    actions,
    showOps,
    showScore,
}: {
    idx: number;
    vms: LeadCardVM[];
    profiles: Record<string, LeadProfileSummary>;
    actions: LeadActionHandlers;
    showOps: boolean;
    showScore: boolean;
}) {
    const { t } = useTranslation('crmPages');
    const vm = vms[idx]!;
    const profile = vm.userId ? profiles[vm.userId] : undefined;
    const { statuses } = useLeadStatuses({ skip: !vm.leadStatus });
    const status = useMemo(
        () =>
            vm.leadStatus
                ? statuses.find((s) => s.status_key === vm.leadStatus || s.label === vm.leadStatus)
                : undefined,
        [statuses, vm.leadStatus]
    );
    const callGate = actions.onCallLead && actions.canCall ? actions.canCall(vm) : null;
    const aiGateFn = actions.canAiCall ?? actions.canCall;
    const aiGate = actions.onAiCallLead && aiGateFn ? aiGateFn(vm) : null;
    const canAssign = showOps && !!actions.onAssignCounsellor;
    const nba = nextBestAction(vm, profile, canAssign, t);

    const run = (a: NbaAction) => {
        if (a === 'call' && callGate?.allowed) actions.onCallLead?.(vm);
        else if (a === 'assign' && vm.userId) actions.onAssignCounsellor?.(vm.userId, vm.name);
        else if (vm.userId) actions.onAddNote?.(vm.userId, vm.name, vm.responseId);
    };
    const nbaCta =
        nba.action === 'call' && !callGate?.allowed
            ? t('drawer.quick.note')
            : t(`drawer.quick.${nba.action}`);

    const quick: Array<{
        key: string;
        icon: Icon;
        label: string;
        onClick?: () => void;
        disabled?: boolean;
        title?: string;
    }> = [];
    if (actions.onCallLead && callGate) {
        quick.push({
            key: 'call',
            icon: Phone,
            label: t('drawer.quick.call'),
            onClick: () => actions.onCallLead?.(vm),
            disabled: !callGate.allowed,
            title: callGate.reason,
        });
    }
    if (actions.onAiCallLead && aiGate) {
        quick.push({
            key: 'ai',
            icon: Robot,
            label: t('drawer.quick.ai'),
            onClick: () => actions.onAiCallLead?.(vm),
            disabled: !aiGate.allowed,
            title: aiGate.reason,
        });
    }
    if (actions.onAddNote && vm.userId) {
        quick.push({
            key: 'note',
            icon: NotePencil,
            label: t('drawer.quick.note'),
            onClick: () => actions.onAddNote?.(vm.userId!, vm.name, vm.responseId),
        });
    }
    if (canAssign && vm.userId) {
        quick.push({
            key: 'assign',
            icon: UserPlus,
            label: t('drawer.quick.assign'),
            onClick: () => actions.onAssignCounsellor?.(vm.userId!, vm.name),
        });
    }

    const prev = idx > 0 ? vms[idx - 1] : undefined;
    const next = idx < vms.length - 1 ? vms[idx + 1] : undefined;
    const navBtn =
        'inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-700 transition-colors hover:border-primary-300 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40';
    const quickCls =
        'flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white px-1 py-2 text-neutral-700 transition-colors hover:border-primary-300 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40';

    return (
        <div className="flex flex-col gap-2 pt-1">
            {/* Previous / Next through the page this lead was opened from. */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    className={navBtn}
                    disabled={!prev}
                    onClick={() => prev && actions.onOpenDetails(prev)}
                    title={prev?.name}
                >
                    <CaretLeft size={12} />
                    <span className="text-caption">{t('drawer.prev')}</span>
                </button>
                <span className="flex-1 text-center tabular-nums text-neutral-500">
                    <span className="text-caption">
                        {t('drawer.position', { index: idx + 1, total: vms.length })}
                    </span>
                </span>
                <button
                    type="button"
                    className={navBtn}
                    disabled={!next}
                    onClick={() => next && actions.onOpenDetails(next)}
                    title={next?.name}
                >
                    <span className="text-caption">{t('drawer.next')}</span>
                    <CaretRight size={12} />
                </button>
            </div>

            {/* Status, stage, SLA, owner. */}
            <div className="flex flex-wrap items-center gap-1.5">
                {status && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2 py-0.5 font-medium text-neutral-700">
                        <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: status.color }} // design-lint-ignore: admin-picked status hex
                        />
                        <span className="text-caption">{status.label}</span>
                    </span>
                )}
                {showOps && profile && (
                    <LeadStageChip
                        tier={profile.lead_tier}
                        conversionStatus={profile.conversion_status}
                    />
                )}
                <TatStatusBadge
                    tatOverdue={vm.tatOverdue}
                    tatDueSoon={vm.tatDueSoon}
                    followUpOverdue={vm.followUpOverdue}
                />
                {showOps && profile && (
                    <span className="inline-flex items-center gap-1 text-neutral-500">
                        <span className="text-caption">
                            {t('drawer.owner')}{' '}
                            <b className="text-neutral-800">
                                {profile.assigned_counselor_name || t('drawer.unassigned')}
                            </b>
                        </span>
                    </span>
                )}
            </div>
            {showScore && profile && profile.best_score > 0 && (
                <LeadScoreBar score={profile.best_score} />
            )}

            {/* Next best action. */}
            <div
                className={cn('flex items-start gap-2 rounded-lg border p-2.5', NBA_TONE[nba.tone])}
            >
                <Lightning size={16} weight="fill" className="mt-0.5 shrink-0 text-primary-500" />
                <span className="min-w-0 flex-1">
                    <span className="block font-semibold uppercase tracking-wide text-neutral-500">
                        <span className="text-caption">{t('drawer.nba.label')}</span>
                    </span>
                    <span className="block font-semibold text-neutral-900">
                        <span className="text-body">{nba.title}</span>
                    </span>
                    <span className="block text-neutral-600">
                        <span className="text-caption">{nba.text}</span>
                    </span>
                </span>
                {nba.key !== 'closed' && (
                    <button
                        type="button"
                        onClick={() => run(nba.action)}
                        className="shrink-0 rounded-md bg-primary-500 px-2.5 py-1 font-medium text-white transition-colors hover:bg-primary-600"
                    >
                        <span className="text-caption">{nbaCta}</span>
                    </button>
                )}
            </div>

            {/* Quick actions. */}
            {quick.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {quick.map((q) => {
                        const inner = (
                            <>
                                <q.icon size={16} />
                                <span className="text-caption">{q.label}</span>
                            </>
                        );
                        return (
                            <button
                                key={q.key}
                                type="button"
                                className={quickCls}
                                onClick={q.onClick}
                                disabled={q.disabled}
                                title={q.title}
                            >
                                {inner}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
