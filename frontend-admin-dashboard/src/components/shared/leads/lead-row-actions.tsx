import { ArrowUpRight, Plus, UserPlus } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { LeadCardVM } from './lead-view-model';
import type { LeadActionHandlers } from './lead-actions';
import { LeadActionsMenu } from './lead-actions-menu';

/**
 * LeadRowActions — the right-aligned action cluster for a lead table row.
 * Quick icons (Open / Add note / Assign) stay hidden until the row is hovered
 * or an action is focused (`group/row` lives on MyTable's <tr>), keeping rows
 * calm. The ⋮ overflow is always visible so there's an affordance on touch /
 * keyboard and for the rest (Set status / Set tier / extras).
 */

interface LeadRowActionsProps {
    vm: LeadCardVM;
    currentTier?: string | null;
    currentStatus?: string | null;
    showOps: boolean;
    actions: LeadActionHandlers;
}

const QUICK =
    'inline-flex size-7 items-center justify-center rounded-md text-neutral-500 opacity-0 transition hover:bg-neutral-100 hover:text-primary-600 focus-visible:opacity-100 group-hover/row:opacity-100';

export function LeadRowActions({
    vm,
    currentTier,
    currentStatus,
    showOps,
    actions,
}: LeadRowActionsProps) {
    const { userId, name } = vm;
    const canOps = showOps && !!userId;

    return (
        <div className="flex items-center justify-end gap-0.5">
            <button
                type="button"
                title="Open details"
                aria-label="Open details"
                onClick={(e) => {
                    e.stopPropagation();
                    actions.onOpenDetails(vm);
                }}
                className={QUICK}
            >
                <ArrowUpRight className="size-4" />
            </button>
            {canOps && actions.onAddNote && (
                <button
                    type="button"
                    title="Add note"
                    aria-label="Add note"
                    onClick={(e) => {
                        e.stopPropagation();
                        actions.onAddNote!(userId!, name);
                    }}
                    className={QUICK}
                >
                    <Plus className="size-4" />
                </button>
            )}
            {canOps && actions.onAssignCounsellor && (
                <button
                    type="button"
                    title="Assign counsellor"
                    aria-label="Assign counsellor"
                    onClick={(e) => {
                        e.stopPropagation();
                        actions.onAssignCounsellor!(userId!, name);
                    }}
                    className={QUICK}
                >
                    <UserPlus className="size-4" />
                </button>
            )}
            <LeadActionsMenu
                vm={vm}
                currentTier={currentTier}
                currentStatus={currentStatus}
                showOps={showOps}
                actions={actions}
            />
        </div>
    );
}
