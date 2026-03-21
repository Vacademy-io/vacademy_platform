/**
 * CategoryRail — The narrow left vertical bar (Gmail-style)
 *
 * Shows category icons (CRM, LMS, AI) + Recent tabs + Settings (admin-only).
 * Each category has icon + small label below.
 * Active category gets a pill-shaped indicator.
 *
 * When the panel is collapsed, hovering a category shows a flyout popover
 * with all tabs for that category.
 */

import React, { useState } from 'react';
import {
    Briefcase,
    GraduationCap,
    Sparkle,
    ClockCounterClockwise,
    GearSix,
    MagnifyingGlass,
    LockKey,
} from '@phosphor-icons/react';
import { SidebarSearch } from './sidebar-search';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS } from './sidebar-colors';
import { motion } from 'framer-motion';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { DisplaySettingsData } from '@/types/display-settings';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useSidebar } from '@/components/ui/sidebar';
import { SidebarItemsType } from '@/types/layout-container/layout-container-types';
import { CategoryFlyoutMenu } from './collapsed-category-flyout';
import { useIsMobile } from '@/hooks/use-mobile';

export type CategoryId = 'CRM' | 'LMS' | 'AI' | 'RECENT' | 'SETTINGS';

interface CategoryRailProps {
    activeCategory: CategoryId;
    onCategoryChange: (category: CategoryId) => void;
    roleDisplay: DisplaySettingsData | null;
    /** All sidebar items (used for flyout when collapsed) */
    sidebarItems?: SidebarItemsType[];
    /** Institute ID for filtering */
    instituteId?: string;
}

interface CategoryConfig {
    id: CategoryId;
    label: string;
    icon: React.FC<any>;
}

const BASE_CATEGORIES: CategoryConfig[] = [
    { id: 'CRM', label: 'CRM', icon: Briefcase },
    { id: 'LMS', label: 'LMS', icon: GraduationCap },
    { id: 'AI', label: 'AI', icon: Sparkle },
];

/** Animated pill background used by category, recent, and settings buttons */
const ActivePill: React.FC<{ className?: string }> = ({ className }) => (
    <motion.div
        layoutId="category-rail-active"
        className={cn('absolute inset-0 rounded-xl', className || 'bg-white')}
        transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
    />
);

/** Extracted component to reduce cognitive complexity of CategoryRail */
function CategoryButton({
    label,
    categoryId,
    Icon,
    isActive,
    isLocked,
    activeBg,
    activeIconClass,
    activeTextClass,
    onCategoryChange,
    onLockedClick,
}: {
    label: string;
    categoryId: CategoryId;
    Icon: React.FC<{ size: number; weight: string; className: string }>;
    isActive: boolean;
    isLocked: boolean | undefined;
    activeBg?: string;
    activeIconClass?: string;
    activeTextClass?: string;
    onCategoryChange: (categoryId: CategoryId) => void;
    onLockedClick: () => void;
}) {
    return (
        <button
            className={cn(
                'relative flex w-14 flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 transition-all duration-200',
                'hover:bg-white/10',
                isLocked && 'cursor-not-allowed opacity-60'
            )}
            aria-label={`${label} category${isActive ? ' (active)' : ''}${isLocked ? ' (locked)' : ''}`}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => {
                if (isLocked) {
                    onLockedClick();
                    return;
                }
                onCategoryChange(categoryId);
            }}
        >
            {isActive && <ActivePill className={activeBg} />}
            <span className="relative z-10">
                {isLocked ? (
                    <LockKey size={22} weight="duotone" className="text-neutral-400" />
                ) : (
                    <Icon
                        size={22}
                        weight={isActive ? 'fill' : 'regular'}
                        className={cn(
                            'transition-colors duration-200',
                            isActive ? activeIconClass || 'text-primary-600' : 'text-white/70'
                        )}
                    />
                )}
            </span>
            <span
                className={cn(
                    'relative z-10 text-[10px] font-medium leading-tight transition-colors duration-200',
                    isActive ? activeTextClass || 'text-white' : 'text-white/70'
                )}
            >
                {label}
            </span>
        </button>
    );
}

export const CategoryRail: React.FC<CategoryRailProps> = ({
    activeCategory,
    onCategoryChange,
    roleDisplay,
    sidebarItems = [],
    instituteId,
}) => {
    const navigate = useNavigate();
    const router = useRouter();
    const currentRoute = router.state.location.pathname;
    const { state } = useSidebar();
    const isMobile = useIsMobile();
    const isPanelCollapsed = state === 'collapsed' && !isMobile;
    const [searchOpen, setSearchOpen] = useState(false);

    // Check if Settings should be shown (it exists in finalSidebarItems only for admins)
    const hasSettings = sidebarItems.some((item) => item.id === 'settings');

    // Sort categories by display settings order
    const sortedCategories = [...BASE_CATEGORIES].sort((a, b) => {
        const cfgA = roleDisplay?.sidebarCategories?.find((c) => c.id === a.id);
        const cfgB = roleDisplay?.sidebarCategories?.find((c) => c.id === b.id);
        return (cfgA?.order ?? 0) - (cfgB?.order ?? 0);
    });

    // Filter by visibility
    const visibleCategories = sortedCategories.filter((cat) => {
        if (cat.id === 'RECENT') return true;
        const cfg = roleDisplay?.sidebarCategories?.find((c) => c.id === cat.id);
        return cfg ? cfg.visible !== false : true;
    });

    // Get items for a specific category (excluding settings from CRM)
    const getItemsForCategory = (catId: 'CRM' | 'LMS' | 'AI') => {
        return sidebarItems.filter((item) => {
            if (item.id === 'settings') return false; // Settings is rendered separately
            const show = item.showForInstitute;
            const category = item.category || 'CRM';
            return (!show || show === instituteId) && category === catId;
        });
    };

    const isSettingsActive = currentRoute.startsWith('/settings');

    const renderCategoryButton = (cat: CategoryConfig) => {
        const isActive = activeCategory === cat.id && !isSettingsActive;
        const isLocked =
            cat.id !== 'RECENT' &&
            roleDisplay?.sidebarCategories?.find((c) => c.id === cat.id)?.locked;
        const colors =
            cat.id !== 'RECENT' ? CATEGORY_COLORS[cat.id as 'CRM' | 'LMS' | 'AI'] : undefined;

        const buttonContent = (
            <CategoryButton
                label={cat.label}
                categoryId={cat.id}
                Icon={cat.icon}
                isActive={isActive}
                isLocked={isLocked}
                activeBg={colors?.railActiveBg}
                activeIconClass={colors?.railIconActive}
                activeTextClass={colors?.text}
                onCategoryChange={onCategoryChange}
                onLockedClick={() => navigate({ to: '/locked-feature', search: { feature: `${cat.label} Category` } })}
            />
        );

        if (isPanelCollapsed && cat.id !== 'RECENT' && !isLocked) {
            const catItems = getItemsForCategory(cat.id as 'CRM' | 'LMS' | 'AI');
            return (
                <CategoryFlyoutMenu key={cat.id} category={cat.id as 'CRM' | 'LMS' | 'AI'} items={catItems}>
                    {buttonContent}
                </CategoryFlyoutMenu>
            );
        }

        return <React.Fragment key={cat.id}>{buttonContent}</React.Fragment>;
    };

    return (
        <nav className="flex h-full w-16 flex-shrink-0 flex-col items-center border-r border-primary-600 bg-primary-500 py-3" role="navigation" aria-label="Main category navigation">
            {/* Search Icon */}
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <button
                        className={cn(
                            'mb-2 flex w-10 items-center justify-center rounded-lg p-2 transition-all duration-200',
                            'text-white/70 hover:bg-white/10 hover:text-white'
                        )}
                        onClick={() => setSearchOpen(true)}
                        aria-label="Search (⌘K)"
                    >
                        <MagnifyingGlass size={20} weight="regular" />
                    </button>
                </TooltipTrigger>
                {!isMobile && (
                    <TooltipContent side="right" className="flex items-center gap-2 font-medium">
                        Search
                        <kbd className="rounded border border-primary-400 bg-primary-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            ⌘K
                        </kbd>
                    </TooltipContent>
                )}
            </Tooltip>

            {/* Divider after search */}
            <div className="mb-1 h-px w-8 bg-primary-400/50" />

            {/* Category Icons */}
            <div className="flex flex-1 flex-col items-center gap-1" role="group" aria-label="Categories">
                {visibleCategories.map((cat) => renderCategoryButton(cat))}

                {/* Divider before Recent */}
                <div className="my-1 h-px w-8 bg-primary-400/50" />

                {/* Recent Tab */}
                {(() => {
                    const isRecentActive = activeCategory === 'RECENT' && !isSettingsActive;
                    return (
                        <button
                            className={cn(
                                'relative flex w-14 flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 transition-all duration-200',
                                'hover:bg-white/10',
                            )}
                            aria-label={`Recent items${isRecentActive ? ' (active)' : ''}`}
                            aria-current={isRecentActive ? 'true' : undefined}
                            onClick={() => onCategoryChange('RECENT')}
                        >
                            {isRecentActive && <ActivePill />}
                            <span className="relative z-10">
                                <ClockCounterClockwise
                                    size={22}
                                    weight={isRecentActive ? 'fill' : 'regular'}
                                    className={cn('transition-colors duration-200', isRecentActive ? 'text-neutral-900' : 'text-white/70')}
                                />
                            </span>
                            <span className={cn('relative z-10 text-[10px] font-medium leading-tight transition-colors duration-200', isRecentActive ? 'text-neutral-900' : 'text-white/70')}>
                                Recent
                            </span>
                        </button>
                    );
                })()}
            </div>

            {/* ─── Settings (admin-only, pinned to bottom) ──── */}
            {hasSettings && (
                <>
                    <div className="my-1 h-px w-8 bg-primary-400/50" />
                    <button
                        className={cn(
                            'relative flex w-14 flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 transition-all duration-200',
                            'hover:bg-white/10',
                        )}
                        aria-label={`Settings${isSettingsActive ? ' (active)' : ''}`}
                        aria-current={isSettingsActive ? 'page' : undefined}
                        onClick={() => {
                            navigate({ to: '/settings', search: { selectedTab: 'tab' } });
                            onCategoryChange('SETTINGS');
                        }}
                    >
                        {isSettingsActive && <ActivePill />}
                        <span className="relative z-10">
                            <GearSix
                                size={22}
                                weight={isSettingsActive ? 'fill' : 'regular'}
                                className={cn('transition-colors duration-200', isSettingsActive ? 'text-neutral-900' : 'text-white/70')}
                            />
                        </span>
                        <span className={cn('relative z-10 text-[10px] font-medium leading-tight transition-colors duration-200', isSettingsActive ? 'text-neutral-900' : 'text-white/70')}>
                            Settings
                        </span>
                    </button>
                </>
            )}

            {/* Search Command Palette */}
            <SidebarSearch
                open={searchOpen}
                onOpenChange={setSearchOpen}
                sidebarItems={sidebarItems}
                instituteId={instituteId}
            />
        </nav>
    );
};
