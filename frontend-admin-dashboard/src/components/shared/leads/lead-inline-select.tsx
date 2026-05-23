import { Check } from '@phosphor-icons/react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * LeadInlineSelect — a compact, inline-editable chip for the lead table. Shows
 * the current value as a coloured pill; clicking opens a dropdown to change it.
 * Used for Status (Lead/Converted/Lost) and Tier (Hot/Warm/Cold). Pure
 * presentational — the parent supplies `onChange` (a mutation).
 *
 * All click handlers stop propagation so editing a chip never opens the row's
 * side view.
 */

export interface LeadInlineOption {
    value: string;
    label: string;
    /** Pill classes for the selected look, e.g. 'bg-red-100 text-red-700'. */
    chipClass: string;
    /** Optional leading dot colour. */
    dotClass?: string;
}

interface LeadInlineSelectProps {
    value?: string | null;
    options: LeadInlineOption[];
    onChange: (value: string) => void;
    /** Shown when the value is empty/unknown. */
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

// Shared option sets (palette mirrors LeadStageChip / the side-view controls).
export const LEAD_STATUS_OPTIONS: LeadInlineOption[] = [
    {
        value: 'LEAD',
        label: 'Lead',
        chipClass: 'bg-blue-100 text-blue-700',
        dotClass: 'bg-blue-500',
    },
    {
        value: 'CONVERTED',
        label: 'Converted',
        chipClass: 'bg-emerald-100 text-emerald-700',
        dotClass: 'bg-emerald-500',
    },
    { value: 'LOST', label: 'Lost', chipClass: 'bg-red-100 text-red-700', dotClass: 'bg-red-500' },
];

export const LEAD_TIER_OPTIONS: LeadInlineOption[] = [
    { value: 'HOT', label: 'Hot', chipClass: 'bg-red-100 text-red-700', dotClass: 'bg-red-500' },
    {
        value: 'WARM',
        label: 'Warm',
        chipClass: 'bg-amber-100 text-amber-700',
        dotClass: 'bg-amber-500',
    },
    {
        value: 'COLD',
        label: 'Cold',
        chipClass: 'bg-blue-100 text-blue-700',
        dotClass: 'bg-blue-500',
    },
];

export function LeadInlineSelect({
    value,
    options,
    onChange,
    placeholder = 'Set',
    disabled,
    className,
}: LeadInlineSelectProps) {
    const current = options.find((o) => o.value.toUpperCase() === (value ?? '').toUpperCase());

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled}>
                <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition',
                        current
                            ? current.chipClass
                            : 'border border-dashed border-neutral-300 text-neutral-400',
                        disabled
                            ? 'cursor-default opacity-70'
                            : current
                              ? 'cursor-pointer hover:brightness-95'
                              : 'cursor-pointer hover:border-neutral-400 hover:text-neutral-600',
                        className
                    )}
                >
                    {current?.dotClass && (
                        <span className={cn('size-1.5 shrink-0 rounded-full', current.dotClass)} />
                    )}
                    <span className="truncate">{current?.label ?? placeholder}</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                className="w-40"
                onClick={(e) => e.stopPropagation()}
            >
                {options.map((o) => (
                    <DropdownMenuItem
                        key={o.value}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (o.value !== current?.value) onChange(o.value);
                        }}
                    >
                        {o.dotClass && (
                            <span className={cn('mr-2 size-2 shrink-0 rounded-full', o.dotClass)} />
                        )}
                        {o.label}
                        {current?.value === o.value && <Check className="ml-auto size-3.5" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
