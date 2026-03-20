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
import { SidebarItemsType } from '@/types/layout-container/layout-container-types';
import { LockKey } from '@phosphor-icons/react';
import { recordRecentTab } from './recent-tabs-store';

interface SidebarSearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Already role + display-settings filtered items */
    sidebarItems: SidebarItemsType[];
    instituteId?: string;
}

export const SidebarSearch: React.FC<SidebarSearchProps> = ({
    open,
    onOpenChange,
    sidebarItems,
    instituteId,
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

    // Group items by category
    const groupedItems = React.useMemo(() => {
        const groups: Record<'CRM' | 'LMS' | 'AI', SidebarItemsType[]> = {
            CRM: [],
            LMS: [],
            AI: [],
        };

        sidebarItems.forEach((item) => {
            // Skip settings — it has its own rail icon
            if (item.id === 'settings') return;

            // Filter by institute
            if (item.showForInstitute && item.showForInstitute !== instituteId) return;

            const category = item.category || 'CRM';
            if (groups[category]) {
                groups[category].push(item);
            }
        });

        return groups;
    }, [sidebarItems, instituteId]);

    const handleSelect = useCallback(
        (to: string | undefined, title: string, category?: string, itemId?: string) => {
            if (!to) return;
            // Record in recent tabs
            recordRecentTab({
                id: itemId || to,
                label: title,
                route: to,
                category: (category as 'CRM' | 'LMS' | 'AI') || 'CRM',
            });
            navigate({ to });
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
        const colors = CATEGORY_COLORS[(item.category || 'CRM') as 'CRM' | 'LMS' | 'AI'];
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
                        <span className="text-[10px] font-medium text-neutral-400">Locked</span>
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
                            handleSelect(sub.subItemLink, sub.subItem || '', item.category, sub.subItemId)
                        }
                        className="gap-3 px-3 py-2"
                    >
                        <div className="w-[18px] shrink-0" /> {/* Indent for sub-items */}
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
                        <span className="text-[10px] text-neutral-400">{item.title}</span>
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
                    const colors = CATEGORY_COLORS[category as 'CRM' | 'LMS' | 'AI'];

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

                {/* Settings (if available) */}
                {sidebarItems.some((item) => item.id === 'settings') && (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Settings">
                            <CommandItem
                                value="Settings Configuration"
                                onSelect={() => handleSelect('/settings', 'Settings')}
                                className="gap-3 px-3 py-2.5"
                            >
                                <span className="text-sm">⚙️</span>
                                <span className="flex-1">Settings</span>
                                <span className="text-[10px] text-neutral-400">⌘ ,</span>
                            </CommandItem>
                        </CommandGroup>
                    </>
                )}
            </CommandList>
        </CommandDialog>
    );
};
