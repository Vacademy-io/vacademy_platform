import { useState } from 'react';
import { GearSix } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { isUserAdmin } from '@/utils/userDetails';
import type { ListCustomFieldSurface } from '@/types/display-settings';
import { ManageListFiltersDialog } from './manage-list-filters-dialog';

interface ManageListFiltersLinkProps {
    /** The list surface this button belongs to — opens the popup on that tab. */
    surface: ListCustomFieldSurface;
    className?: string;
}

/**
 * "Manage filters" affordance in a list page's filter bar. Opens a focused
 * popup to choose which custom fields appear as filters/sorts on this surface,
 * instead of navigating away to the full Display Settings screen. Admin-only:
 * it edits institute-wide config stored in the ADMIN display-settings blob.
 */
export function ManageListFiltersLink({ surface, className }: ManageListFiltersLinkProps) {
    const [open, setOpen] = useState(false);

    if (!isUserAdmin()) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                    'inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700',
                    className
                )}
                title="Choose which custom fields appear as filters on this list"
            >
                <GearSix className="size-3.5" />
                Manage filters
            </button>
            <ManageListFiltersDialog open={open} onOpenChange={setOpen} surface={surface} />
        </>
    );
}
