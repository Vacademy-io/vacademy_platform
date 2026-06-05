import { cn } from '@/lib/utils';
import {
    SECTION_REGISTRY,
    GROUP_ORDER,
    GROUP_TO_MODULE,
    type SectionGroup,
} from './nav-groups';

/**
 * Grouped left-rail navigation — vertical 208px sidebar inside the learner
 * profile drawer when client setting `navStyle === 'grouped'`.
 *
 * Per Vacademy design handoff:
 *   - 208px wide, --bg-warm bg, 1px right border, scrollable
 *   - Sections grouped under uppercase labels (Snapshot · Learning · Finance
 *     · CRM · Account · Records)
 *   - Each nav item: 13.5px / 600, radius --r-md, icon 17px + label
 *   - active = primary bg + white text
 *   - hover  = primary-50 bg + primary-700 text
 *
 * Items hide when their visibility flag is off (existing TAB_VISIBILITY
 * settings) or when their group module is disabled (handoff GROUP_MODULE
 * mapping).
 */
export const GroupedNavRail = ({
    activeId,
    onSelect,
    visibleIds,
    enabledModules,
}: {
    activeId: string;
    onSelect: (id: string) => void;
    /** Set of section IDs that pass the per-client visibility flags. */
    visibleIds: Set<string>;
    /** Which feature modules the client tenant has enabled. Snapshot is
        always on (no module gates it). */
    enabledModules: Record<'learning' | 'finance' | 'crm' | 'account' | 'records', boolean>;
}) => {
    const groups = GROUP_ORDER.map((g) => {
        const module = GROUP_TO_MODULE[g];
        // Module-gated group disabled → drop entire group.
        if (module && !enabledModules[module]) return null;
        const items = SECTION_REGISTRY.filter(
            (s) => s.group === g && visibleIds.has(s.id)
        );
        if (items.length === 0) return null;
        return { group: g, items };
    }).filter(Boolean) as Array<{
        group: SectionGroup;
        items: typeof SECTION_REGISTRY[number][];
    }>;

    return (
        <nav
            aria-label="Profile sections"
            // Handoff: 208px (w-52) width, warm cream surface (bg-neutral-50
            // ≈ --bg-warm), 14px vertical / 12px horizontal padding, hairline
            // right border.
            className="flex w-52 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border bg-neutral-50 px-3 py-3.5"
        >
            {groups.map(({ group, items }) => (
                <div key={group} className="flex flex-col gap-0.5">
                    {/* Handoff group label: ~10.5px / 700 / wide tracking /
                        uppercase / muted. Sits in 0 10px 6px padding. */}
                    <div className="px-2.5 pb-1.5 text-caption font-bold uppercase tracking-widest text-muted-foreground">
                        {group}
                    </div>
                    {items.map((item) => {
                        const isActive = item.id === activeId;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onSelect(item.id)}
                                aria-current={isActive ? 'page' : undefined}
                                // Handoff NavBtn: 9px 11px padding, 13.5/600
                                // label, gap 11px, var(--r-md) (10px ≈
                                // rounded-md). Icon ~17px, duotone weight.
                                // Active = accent bg + on-accent fg.
                                // Hover  = accent-soft bg + accent-text fg.
                                className={cn(
                                    'flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                                    isActive
                                        ? 'bg-primary-500 text-white shadow-sm'
                                        : 'text-card-foreground hover:bg-primary-50 hover:text-primary-700'
                                )}
                            >
                                <Icon
                                    className="size-4 shrink-0"
                                    weight={isActive ? 'fill' : 'duotone'}
                                />
                                <span className="truncate">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            ))}
        </nav>
    );
};
