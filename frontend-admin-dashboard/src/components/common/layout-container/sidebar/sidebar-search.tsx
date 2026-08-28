/**
 * SidebarSearch — Command palette for quick tab navigation
 *
 * Searches through all sidebar items (already filtered by role + display settings).
 * Groups results by category (CRM, LMS, AI) with color-coded badges.
 * Supports sub-items as searchable entries.
 * Opens with search icon click or ⌘K keyboard shortcut.
 */

import React, { useEffect, useCallback } from 'react';
import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator,
} from '@/components/ui/command';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS } from './sidebar-colors';
import { SidebarItemsType, SidebarCategory } from '@/types/layout-container/layout-container-types';
import type { DisplaySettingsData } from '@/types/display-settings';
import { LockKey, GearSix } from '@phosphor-icons/react';
import { recordRecentTab } from './recent-tabs-store';
import { parseSidebarLink } from './helper';
import { SETTINGS_TAB_ICONS } from './sidebar-panel';
import {
    getAvailableSettingsTabs,
    SETTINGS_DOMAIN_ORDER,
    type SettingsTabEntry,
} from '@/routes/settings/-utils/utils';

interface SidebarSearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Already role + display-settings filtered items */
    sidebarItems: SidebarItemsType[];
    instituteId?: string;
    /** Sidebar category visibility — hidden categories are dropped from results. */
    sidebarCategories?: DisplaySettingsData['sidebarCategories'];
}

export const SidebarSearch: React.FC<SidebarSearchProps> = ({
    open,
    onOpenChange,
    sidebarItems,
    instituteId,
    sidebarCategories,
}) => {
    const navigate = useNavigate();

    // ⌘K keyboard shortcut
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onOpenChange(!open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [open, onOpenChange]);

    // Build a quick lookup for hidden categories so we can skip them entirely.
    const hiddenCategoryIds = React.useMemo(() => {
        const set = new Set<SidebarCategory>();
        (sidebarCategories || []).forEach((c) => {
            if (c.visible === false) set.add(c.id as SidebarCategory);
        });
        return set;
    }, [sidebarCategories]);

    // Group items by category
    const groupedItems = React.useMemo(() => {
        const groups: Record<SidebarCategory, SidebarItemsType[]> = {
            CRM: [],
            LMS: [],
            AI: [],
            ERP: [],
        };

        sidebarItems.forEach((item) => {
            // Skip settings — it has its own rail icon
            if (item.id === 'settings') return;

            // Filter by institute
            if (item.showForInstitute && item.showForInstitute !== instituteId) return;

            const category = (item.category || 'CRM') as SidebarCategory;
            // Drop entries that belong to a category the role has hidden — surfacing
            // them in search would let users click through to features the sidebar
            // is hiding for them.
            if (hiddenCategoryIds.has(category)) return;
            if (groups[category]) {
                groups[category].push(item);
            }
        });

        return groups;
    }, [sidebarItems, instituteId, hiddenCategoryIds]);

    // Every settings screen, grouped by its top-level domain — indexed
    // directly from the same registry the /settings page itself renders from,
    // so search can never drift out of sync with what's actually there.
    const settingsByDomain = React.useMemo(() => {
        const map = new Map<string, SettingsTabEntry[]>();
        getAvailableSettingsTabs().forEach((entry) => {
            if (!map.has(entry.domain)) map.set(entry.domain, []);
            map.get(entry.domain)!.push(entry);
        });
        return map;
    }, []);

    const handleSelect = useCallback(
        (to: string | undefined, title: string, category?: string, itemId?: string) => {
            if (!to) return;
            // Record in recent tabs
            recordRecentTab({
                id: itemId || to,
                label: title,
                route: to,
                category: (category as SidebarCategory) || 'CRM',
            });
            // Sidebar links may carry a query ("/settings?selectedTab=…"); the
            // router only honours it when it's passed as `search`.
            const { to: path, search } = parseSidebarLink(to);
            navigate({ to: path, search });
            onOpenChange(false);
        },
        [navigate, onOpenChange]
    );

    // Settings entries navigate with a selectedTab search param, which the
    // generic handleSelect above doesn't support (no other caller needs it) —
    // kept as its own small handler instead of growing handleSelect's signature.
    const handleSettingsSelect = useCallback(
        (entry: SettingsTabEntry) => {
            recordRecentTab({
                id: entry.tab,
                label: entry.value,
                route: '/settings',
                category: 'CRM',
            });
            navigate({ to: '/settings', search: { selectedTab: entry.tab } });
            onOpenChange(false);
        },
        [navigate, onOpenChange]
    );

    const categoryLabels: Record<string, string> = {
        CRM: 'CRM',
        LMS: 'Learning',
        AI: 'AI Tools',
    };

    const renderItem = (item: SidebarItemsType) => {
        const colors = CATEGORY_COLORS[(item.category || 'CRM') as SidebarCategory];
        const Icon = item.icon;
        const results: React.ReactNode[] = [];

        // Main item
        if (item.to) {
            results.push(
                <CommandItem
                    key={item.id}
                    value={`${item.title} ${item.category}`}
                    onSelect={() => handleSelect(item.to, item.title, item.category, item.id)}
                    className="gap-3 px-3 py-2.5"
                >
                    {item.locked ? (
                        <LockKey size={18} weight="duotone" className="text-neutral-400" />
                    ) : (
                        <Icon size={18} weight="regular" className={cn(colors.text, 'shrink-0')} />
                    )}
                    <span className="flex-1 truncate">{item.title}</span>
                    {item.locked && (
                        <span className="text-2xs font-medium text-neutral-400">Locked</span>
                    )}
                </CommandItem>
            );
        }

        // Sub-items
        if (item.subItems) {
            item.subItems.forEach((sub) => {
                if (!sub.subItem || !sub.subItemLink) return;
                results.push(
                    <CommandItem
                        key={sub.subItemId}
                        value={`${sub.subItem} ${item.title} ${item.category}`}
                        onSelect={() =>
                            handleSelect(
                                sub.subItemLink,
                                sub.subItem || '',
                                item.category,
                                sub.subItemId
                            )
                        }
                        className="gap-3 px-3 py-2"
                    >
                        {/* Indent for sub-items — w-4 matches the 16px sibling icons */}
                        <div className="w-4 shrink-0" />
                        {sub.locked ? (
                            <LockKey size={16} weight="duotone" className="text-neutral-400" />
                        ) : (
                            <div
                                className={cn(
                                    'h-1.5 w-1.5 shrink-0 rounded-full',
                                    colors.text.replace('text-', 'bg-')
                                )}
                            />
                        )}
                        <span className="flex-1 truncate text-neutral-600">{sub.subItem}</span>
                        <span className="text-2xs text-neutral-400">{item.title}</span>
                    </CommandItem>
                );
            });
        }

        return results;
    };

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput placeholder="Search tabs, features..." />
            <CommandList>
                <CommandEmpty>
                    <div className="flex flex-col items-center gap-1 py-4">
                        <span className="text-sm text-neutral-500">No results found</span>
                        <span className="text-xs text-neutral-400">
                            Try a different search term
                        </span>
                    </div>
                </CommandEmpty>

                {Object.entries(groupedItems).map(([category, items], idx) => {
                    if (items.length === 0) return null;
                    const colors = CATEGORY_COLORS[category as SidebarCategory];

                    return (
                        <React.Fragment key={category}>
                            {idx > 0 && <CommandSeparator />}
                            <CommandGroup
                                heading={
                                    <span className={cn('font-semibold', colors.text)}>
                                        {categoryLabels[category] || category}
                                    </span>
                                }
                            >
                                {items.flatMap(renderItem)}
                            </CommandGroup>
                        </React.Fragment>
                    );
                })}

                {/* Settings — every screen individually searchable, grouped by domain */}
                {sidebarItems.some((item) => item.id === 'settings') &&
                    SETTINGS_DOMAIN_ORDER.map((domain) => {
                        const entries = settingsByDomain.get(domain);
                        if (!entries || entries.length === 0) return null;
                        return (
                            <React.Fragment key={`settings-${domain}`}>
                                <CommandSeparator />
                                <CommandGroup
                                    heading={
                                        <span className="font-semibold text-neutral-500">
                                            Settings · {domain}
                                        </span>
                                    }
                                >
                                    {entries.map((entry) => {
                                        const Icon = SETTINGS_TAB_ICONS[entry.tab] || GearSix;
                                        return (
                                            <CommandItem
                                                key={entry.tab}
                                                value={`${entry.value} ${domain} ${entry.group} settings`}
                                                onSelect={() => handleSettingsSelect(entry)}
                                                className="gap-3 px-3 py-2.5"
                                            >
                                                <Icon
                                                    size={18}
                                                    weight="regular"
                                                    className="shrink-0 text-neutral-400"
                                                />
                                                <span className="flex-1 truncate">
                                                    {entry.value}
                                                </span>
                                                <span className="text-caption text-neutral-400">
                                                    {entry.group}
                                                </span>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </React.Fragment>
                        );
                    })}
            </CommandList>
        </CommandDialog>
    );
};
