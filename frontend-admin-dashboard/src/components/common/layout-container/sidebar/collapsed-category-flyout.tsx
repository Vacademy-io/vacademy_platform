/**
 * CollapsedCategoryFlyout
 *
 * When the sidebar panel is collapsed (only rail visible), this component renders
 * nothing visually but is available to show flyout menus when category rail items
 * are hovered. The flyout menus show the tabs and sub-tabs for the hovered category.
 *
 * Actually — in the Gmail model, when collapsed, the rail icons themselves act as
 * hover triggers. So this component provides a "hover zone" that, when the user
 * hovers over the rail, shows a popover with the menu items.
 *
 * Implementation: We render a thin invisible strip next to the rail. When the user
 * hovers a category icon on the rail, the popover appears showing the menu items.
 *
 * NOTE: The actual flyout interaction is driven by category-rail hover events.
 * This component is the target panel that renders the flyout content.
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { SidebarItemsType } from '@/types/layout-container/layout-container-types';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { getCategoryColors } from './sidebar-colors';
import type { CategoryId } from './category-rail';
import type { DisplaySettingsData } from '@/types/display-settings';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LockKey } from '@phosphor-icons/react';
import { recordRecentTab } from './recent-tabs-store';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface CollapsedCategoryFlyoutProps {
    activeCategory: CategoryId;
    sidebarItems: SidebarItemsType[];
    roleDisplay: DisplaySettingsData | null;
    instituteId?: string;
}

export const CollapsedCategoryFlyout: React.FC<CollapsedCategoryFlyoutProps> = ({
    activeCategory,
    sidebarItems,
    roleDisplay,
    instituteId,
}) => {
    // This component doesn't render anything visible.
    // The flyout behavior for collapsed state is handled inside the CategoryRail
    // via Popovers. But since the rail is purely the narrow bar, we need to
    // intercept category hover/click to show a menu.
    //
    // Approach: We don't need a separate visible component here.
    // Instead, the CategoryRail should trigger the popover directly.
    // However, to keep separation of concerns, this component can render
    // hidden popover triggers that align with the category rail positions.

    // For now, return null — the collapsed flyout interaction will be handled
    // by the CategoryRail's own popover/tooltip mechanism.
    // The actual collapsed hover menu is handled directly in the CategoryRail component.

    return null;
};

/**
 * CategoryFlyoutMenu — Used by the category rail in collapsed mode
 * to show a flyout popover with all tabs for a category.
 */
interface CategoryFlyoutMenuProps {
    category: 'CRM' | 'LMS' | 'AI';
    items: SidebarItemsType[];
    children: React.ReactNode;
}

export const CategoryFlyoutMenu: React.FC<CategoryFlyoutMenuProps> = ({
    category,
    items,
    children,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const navigate = useNavigate();
    const currentRoute = router.state.location.pathname;
    const colors = getCategoryColors(category);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div
                    onMouseEnter={() => setIsOpen(true)}
                    onMouseLeave={() => setIsOpen(false)}
                >
                    {children}
                </div>
            </PopoverTrigger>
            <PopoverContent
                side="right"
                align="start"
                className="ml-0.5 w-auto min-w-[220px] max-w-[280px] p-0"
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {/* Category header */}
                <div className={cn('border-b px-3 py-2')}>
                    <p className={cn('text-sm font-semibold', colors.text)}>
                        {category === 'AI' ? 'AI Tools' : category}
                    </p>
                </div>

                {/* Menu items */}
                <div className="max-h-[60vh] overflow-y-auto p-1">
                    {items.map((item, idx) => (
                        <FlyoutMenuItem
                            key={item.id}
                            item={item}
                            category={category}
                            currentRoute={currentRoute}
                            onClose={() => setIsOpen(false)}
                            showDividerAfter={
                                idx < items.length - 1 &&
                                shouldShowDivider(items, idx)
                            }
                        />
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};

// ─── Flyout Menu Item ──────────────────────────────────────────

interface FlyoutMenuItemProps {
    item: SidebarItemsType;
    category: 'CRM' | 'LMS' | 'AI';
    currentRoute: string;
    onClose: () => void;
    showDividerAfter?: boolean;
}

const FlyoutMenuItem: React.FC<FlyoutMenuItemProps> = ({
    item,
    category,
    currentRoute,
    onClose,
    showDividerAfter,
}) => {
    const [subOpen, setSubOpen] = useState(false);
    const colors = getCategoryColors(category);
    const navigate = useNavigate();

    const isActive = item.to
        ? currentRoute.includes(item.to)
        : item.subItems?.some((s) => s.subItemLink && currentRoute.includes(s.subItemLink));

    if (item.locked) {
        return (
            <>
                <div
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-neutral-400 hover:bg-primary-50"
                    onClick={() => {
                        navigate({ to: '/locked-feature', search: { feature: item.title } });
                        onClose();
                    }}
                >
                    <LockKey size={14} weight="duotone" />
                    <span className="truncate">{item.title}</span>
                </div>
                {showDividerAfter && <div className="mx-2 my-1 h-px bg-primary-100" />}
            </>
        );
    }

    // Non-collapsible (no sub-items)
    if (!item.subItems || item.subItems.length === 0) {
        return (
            <>
                <Link
                    to={item.to}
                    className={cn(
                        'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                        isActive
                            ? cn(colors.pillBg, colors.pillText, 'font-medium')
                            : 'text-neutral-600 hover:bg-primary-50'
                    )}
                    onClick={() => {
                        if (item.to) {
                            recordRecentTab({
                                id: item.id,
                                label: item.title,
                                route: item.to,
                                category,
                            });
                        }
                        onClose();
                    }}
                >
                    {item.icon &&
                        React.createElement(item.icon, {
                            size: 16,
                            weight: isActive ? 'fill' : 'regular',
                            className: cn(
                                'flex-shrink-0',
                                isActive ? colors.pillText : 'text-neutral-500'
                            ),
                        })}
                    <span className="truncate">{item.title}</span>
                </Link>
                {showDividerAfter && <div className="mx-2 my-1 h-px bg-primary-100" />}
            </>
        );
    }

    // Collapsible (has sub-items)
    return (
        <>
            <Collapsible open={subOpen || !!isActive} onOpenChange={setSubOpen}>
                <CollapsibleTrigger className="w-full">
                    <div
                        className={cn(
                            'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                            isActive
                                ? cn(colors.pillBg, colors.pillText, 'font-medium')
                                : 'text-neutral-600 hover:bg-primary-50'
                        )}
                    >
                        {item.icon &&
                            React.createElement(item.icon, {
                                size: 16,
                                weight: isActive ? 'fill' : 'regular',
                                className: cn(
                                    'flex-shrink-0',
                                    isActive ? colors.pillText : 'text-neutral-500'
                                ),
                            })}
                        <span className="flex-1 truncate text-left">{item.title}</span>
                        <ChevronDown
                            className={cn(
                                'size-3 flex-shrink-0 transition-transform',
                                (subOpen || isActive) && 'rotate-180',
                            isActive ? colors.pillText : 'text-neutral-400'
                            )}
                        />
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="ml-4 flex flex-col gap-0.5 border-l border-primary-100 py-0.5 pl-3">
                        {item.subItems.map((sub, idx) => {
                            const isSubActive =
                                sub.subItemLink && currentRoute.includes(sub.subItemLink);
                            return (
                                <Link
                                    key={idx}
                                    to={sub.subItemLink}
                                    className={cn(
                                        'flex items-center rounded-md px-2 py-1 text-[13px] transition-colors',
                                        isSubActive
                                            ? cn(colors.pillBg, colors.pillText, 'font-medium')
                                            : 'text-neutral-500 hover:text-neutral-700 hover:bg-primary-50'
                                    )}
                                    onClick={(e) => {
                                        if (sub.locked) {
                                            e.preventDefault();
                                            navigate({
                                                to: '/locked-feature',
                                                search: { feature: sub.subItem || '' },
                                            });
                                        } else if (sub.subItemLink && sub.subItem) {
                                            recordRecentTab({
                                                id: `${item.id}-${sub.subItemId}`,
                                                label: sub.subItem,
                                                route: sub.subItemLink,
                                                category,
                                                parentId: item.id,
                                                parentLabel: item.title,
                                            });
                                        }
                                        onClose();
                                    }}
                                >
                                    <span className="truncate">{sub.subItem}</span>
                                    {sub.locked && (
                                        <LockKey
                                            size={10}
                                            className="ml-auto flex-shrink-0 text-neutral-400"
                                        />
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </CollapsibleContent>
            </Collapsible>
            {showDividerAfter && <div className="mx-2 my-1 h-px bg-primary-100" />}
        </>
    );
};

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Determine if a divider should be shown after item at index.
 * Shows divider after items that have sub-items (acts as a section divider).
 */
function shouldShowDivider(items: SidebarItemsType[], index: number): boolean {
    const current = items[index];
    const next = items[index + 1];
    if (!next) return false;
    // Show divider when transitioning from a collapsible to non-collapsible or vice versa
    const currentHasSubs = current?.subItems && current.subItems.length > 0;
    const nextHasSubs = next?.subItems && next.subItems.length > 0;
    return !!currentHasSubs !== !!nextHasSubs;
}
