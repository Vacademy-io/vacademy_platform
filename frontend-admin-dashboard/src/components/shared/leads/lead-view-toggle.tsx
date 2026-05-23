import { List, Kanban, Table } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export type LeadView = 'list' | 'board' | 'table';

const OPTIONS: { value: LeadView; label: string; icon: typeof List }[] = [
    { value: 'list', label: 'List', icon: List },
    { value: 'board', label: 'Board', icon: Kanban },
    { value: 'table', label: 'Table', icon: Table },
];

interface LeadViewToggleProps {
    value: LeadView;
    onChange: (view: LeadView) => void;
    /** Hide specific views (e.g. board when the lead system is off). */
    available?: LeadView[];
    className?: string;
}

export function LeadViewToggle({ value, onChange, available, className }: LeadViewToggleProps) {
    const options = available ? OPTIONS.filter((o) => available.includes(o.value)) : OPTIONS;
    return (
        <div
            className={cn(
                'inline-flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-neutral-50 p-0.5',
                className
            )}
            role="tablist"
        >
            {options.map(({ value: v, label, icon: Icon }) => {
                const active = v === value;
                return (
                    <button
                        key={v}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(v)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                            active
                                ? 'bg-white text-neutral-900 shadow-sm'
                                : 'text-neutral-500 hover:text-neutral-700'
                        )}
                    >
                        <Icon className="size-3.5" />
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
