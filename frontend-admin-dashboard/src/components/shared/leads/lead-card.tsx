import { CalendarBlank, Envelope, Megaphone, Phone, Tag } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { LeadProfileSummary } from '@/hooks/use-lead-profiles';
import type { LeadCardVM } from './lead-view-model';
import type { LeadActionHandlers } from './lead-actions';
import { LeadAvatar } from './lead-avatar';
import { LeadStageChip } from './lead-stage-chip';
import { LeadScoreBar } from './lead-score-bar';
import { LeadCounsellor } from './lead-counsellor';
import { LeadActionsMenu } from './lead-actions-menu';

/**
 * LeadCard — the "Deals Pipeline"-style card rendered inside board columns.
 * Pure presentational: no hooks, no fetching. The parent resolves the profile
 * from the cached batch and passes it in.
 */

interface LeadCardProps {
    vm: LeadCardVM;
    profile?: LeadProfileSummary;
    showScore: boolean;
    showOps: boolean;
    actions: LeadActionHandlers;
}

export function LeadCard({ vm, profile, showScore, showOps, actions }: LeadCardProps) {
    return (
        <div
            onClick={() => actions.onOpenDetails(vm)}
            className="group cursor-pointer rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition-all hover:border-neutral-300 hover:shadow"
        >
            <div className="flex items-start justify-between gap-2">
                {showOps ? (
                    <LeadStageChip
                        tier={profile?.lead_tier}
                        conversionStatus={profile?.conversion_status}
                    />
                ) : (
                    <span />
                )}
                <LeadActionsMenu
                    vm={vm}
                    currentTier={profile?.lead_tier}
                    showOps={showOps}
                    actions={actions}
                    className="-mr-1 -mt-1"
                />
            </div>

            <div className="mt-2 flex items-center gap-2">
                <LeadAvatar name={vm.name} size="sm" />
                <p className="min-w-0 truncate text-sm font-semibold text-neutral-900">{vm.name}</p>
            </div>

            <div className="mt-2 space-y-1">
                <p className="flex items-center gap-1.5 truncate text-xs text-neutral-600">
                    <Envelope className="size-3 shrink-0 text-neutral-400" />
                    <span className="truncate">{vm.email}</span>
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-neutral-600">
                    <Phone className="size-3 shrink-0 text-neutral-400" />
                    <span className="truncate">{vm.phone}</span>
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-neutral-500">
                    <Megaphone className="size-3 shrink-0 text-neutral-400" />
                    {/* Channel > list, the same trail the table and the side view show. */}
                    <span className="truncate">
                        {[vm.campaignType, vm.audience].filter((v) => v && v !== '-').join(' › ') ||
                            vm.audience}
                    </span>
                </p>
                {vm.utmCampaign && vm.utmCampaign !== '-' && (
                    <p className="flex items-center gap-1.5 truncate text-xs text-neutral-500">
                        <Tag className="size-3 shrink-0 text-neutral-400" />
                        <span className="truncate" title={vm.utmSource ?? undefined}>
                            {vm.utmCampaign}
                        </span>
                    </p>
                )}
            </div>

            {showScore && profile && (
                <div className="mt-2.5">
                    <LeadScoreBar score={profile.best_score} />
                </div>
            )}

            <div
                className={cn(
                    'mt-2.5 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2'
                )}
            >
                {showOps && vm.userId ? (
                    <LeadCounsellor
                        counsellorName={profile?.assigned_counselor_name}
                        counsellorId={profile?.assigned_counselor_id}
                        onAssign={
                            actions.onAssignCounsellor
                                ? () => actions.onAssignCounsellor!(vm.userId!, vm.name)
                                : undefined
                        }
                    />
                ) : (
                    <span />
                )}
                <span className="flex shrink-0 items-center gap-1 text-xs text-neutral-400">
                    <CalendarBlank className="size-3" />
                    {vm.submittedDisplay}
                </span>
            </div>
        </div>
    );
}
