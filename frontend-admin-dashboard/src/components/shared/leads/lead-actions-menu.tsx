import { DotsThreeVertical, ArrowUpRight, Plus, UserPlus, Flame, Tag } from '@phosphor-icons/react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { LeadCardVM } from './lead-view-model';
import type { LeadActionHandlers, LeadTier, LeadStatus } from './lead-actions';

/**
 * LeadActionsMenu — the overflow (⋮) menu shared by the list rows and board
 * cards. Items degrade gracefully: tier/note/assign actions only appear when the
 * lead system is on (`showOps`) and the lead has a linked user id.
 */

const TIERS: { value: LeadTier; label: string }[] = [
    { value: 'HOT', label: 'Hot' },
    { value: 'WARM', label: 'Warm' },
    { value: 'COLD', label: 'Cold' },
];

const STATUSES: { value: LeadStatus; label: string }[] = [
    { value: 'LEAD', label: 'Lead' },
    { value: 'CONVERTED', label: 'Converted' },
    { value: 'LOST', label: 'Lost' },
];

interface LeadActionsMenuProps {
    vm: LeadCardVM;
    currentTier?: string | null;
    currentStatus?: string | null;
    showOps: boolean;
    actions: LeadActionHandlers;
    className?: string;
}

export function LeadActionsMenu({
    vm,
    currentTier,
    currentStatus,
    showOps,
    actions,
    className,
}: LeadActionsMenuProps) {
    const { userId, name } = vm;
    const canOps = showOps && !!userId;
    const extra = actions.renderExtraActions?.(vm);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Lead actions"
                    className={cn(
                        'inline-flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700',
                        className
                    )}
                >
                    <DotsThreeVertical className="size-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => actions.onOpenDetails(vm)}>
                    <ArrowUpRight className="mr-2 size-4" />
                    Open details
                </DropdownMenuItem>

                {canOps && actions.onAddNote && (
                    <DropdownMenuItem onClick={() => actions.onAddNote!(userId!, name)}>
                        <Plus className="mr-2 size-4" />
                        Add note
                    </DropdownMenuItem>
                )}
                {canOps && actions.onAssignCounsellor && (
                    <DropdownMenuItem onClick={() => actions.onAssignCounsellor!(userId!, name)}>
                        <UserPlus className="mr-2 size-4" />
                        Assign counsellor
                    </DropdownMenuItem>
                )}
                {canOps && actions.onSetStatus && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Tag className="mr-2 size-4" />
                            Set status
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {STATUSES.map((s) => (
                                <DropdownMenuItem
                                    key={s.value}
                                    disabled={(currentStatus ?? '').toUpperCase() === s.value}
                                    onClick={() => actions.onSetStatus!(userId!, name, s.value)}
                                >
                                    {s.label}
                                    {(currentStatus ?? '').toUpperCase() === s.value && (
                                        <span className="ml-auto text-xs text-neutral-400">
                                            Current
                                        </span>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                )}
                {canOps && actions.onSetTier && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Flame className="mr-2 size-4" />
                            Set tier
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {TIERS.map((t) => (
                                <DropdownMenuItem
                                    key={t.value}
                                    disabled={(currentTier ?? '').toUpperCase() === t.value}
                                    onClick={() => actions.onSetTier!(userId!, name, t.value)}
                                >
                                    {t.label}
                                    {(currentTier ?? '').toUpperCase() === t.value && (
                                        <span className="ml-auto text-xs text-neutral-400">
                                            Current
                                        </span>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                )}

                {extra && (
                    <>
                        <DropdownMenuSeparator />
                        {extra}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
