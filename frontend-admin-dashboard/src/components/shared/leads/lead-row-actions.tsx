import { ArrowUpRight, Phone, Plus, Robot, UserPlus } from '@phosphor-icons/react';
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
    // Call gating — `canCall` is the single source of truth; if missing,
    // assume the surface doesn't expose calling at all.
    const callGate = actions.onCallLead && actions.canCall ? actions.canCall(vm) : null;
    // AI Call gating — falls back to canCall (both need a phone on file).
    const aiGateFn = actions.canAiCall ?? actions.canCall;
    const aiGate = actions.onAiCallLead && aiGateFn ? aiGateFn(vm) : null;

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
            {canOps && actions.onCallLead && callGate && (
                <button
                    type="button"
                    title={callGate.allowed ? 'Call lead' : callGate.reason ?? 'Call lead'}
                    aria-label="Call lead"
                    disabled={!callGate.allowed}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (callGate.allowed) actions.onCallLead!(vm);
                    }}
                    className={cn(
                        QUICK,
                        callGate.allowed ? 'hover:text-success-600' : 'cursor-not-allowed opacity-50'
                    )}
                >
                    <Phone className="size-4" />
                </button>
            )}
            {canOps && actions.onAiCallLead && aiGate && (
                <button
                    type="button"
                    title={aiGate.allowed ? 'AI call lead' : aiGate.reason ?? 'AI call lead'}
                    aria-label="AI call lead"
                    disabled={!aiGate.allowed}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (aiGate.allowed) actions.onAiCallLead!(vm);
                    }}
                    className={cn(
                        QUICK,
                        aiGate.allowed
                            ? 'hover:text-primary-600'
                            : 'cursor-not-allowed opacity-50'
                    )}
                >
                    <Robot className="size-4" />
                </button>
            )}
            {canOps && actions.onAddNote && (
                <button
                    type="button"
                    title="Add note"
                    aria-label="Add note"
                    onClick={(e) => {
                        e.stopPropagation();
                        actions.onAddNote!(userId!, name, vm.responseId);
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
