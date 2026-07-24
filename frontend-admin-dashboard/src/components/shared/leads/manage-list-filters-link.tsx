import { GearSix } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/**
 * Quick jump from a list page's filter bar into Settings → Display Settings →
 * "List Filters & Sorting — Custom Fields", where admins choose which custom
 * fields appear as filters on each list surface. Plain anchor, matching the
 * existing deep-link pattern (/settings?selectedTab=<tab>); the #fragment
 * targets the card's wrapper id so supporting browsers land on it directly.
 */
export function ManageListFiltersLink({ className }: { className?: string }) {
    return (
        <a
            href="/settings?selectedTab=roleDisplay#list-custom-field-controls"
            className={cn(
                'inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700',
                className
            )}
            title="Choose which custom fields appear as filters here (Settings → Display Settings)"
        >
            <GearSix className="size-3.5" />
            Manage filters
        </a>
    );
}
