import { Columns } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { LeadColumnToggle } from './use-lead-column-prefs';

interface ManageColumnsPopoverProps {
    /** Toggleable columns, in display order (see buildLeadColumnToggles). */
    columns: LeadColumnToggle[];
    /** Currently hidden column ids. A ticked checkbox means the column is visible. */
    hiddenColumns: Set<string>;
    onToggle: (id: string) => void;
    /** When provided, shows a "Reset" affordance while any column is hidden. */
    onReset?: () => void;
}

/**
 * "Manage Column" popover for the shared LeadTable — a checkbox per toggleable
 * column (ticked = visible). Selection is owned by the caller (see
 * useLeadColumnPrefs) so it can be persisted per surface. Shared by the Recent
 * Leads page and the audience lead list so both behave identically.
 */
export function ManageColumnsPopover({
    columns,
    hiddenColumns,
    onToggle,
    onReset,
}: ManageColumnsPopoverProps) {
    const anyHidden = columns.some((c) => hiddenColumns.has(c.id));
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-10">
                    <Columns className="mr-1.5 size-4" />
                    Manage Column
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52">
                <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Columns
                    </p>
                    {onReset && anyHidden && (
                        <button
                            type="button"
                            onClick={onReset}
                            className="text-xs font-medium text-primary-600 hover:underline"
                        >
                            Reset
                        </button>
                    )}
                </div>
                <div className="space-y-1">
                    {columns.map((c) => (
                        <label
                            key={c.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-neutral-700 hover:bg-neutral-50"
                        >
                            <Checkbox
                                checked={!hiddenColumns.has(c.id)}
                                onCheckedChange={() => onToggle(c.id)}
                            />
                            {c.label}
                        </label>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
