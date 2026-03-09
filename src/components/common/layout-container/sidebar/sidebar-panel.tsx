/**
 * SidebarPanel — The wider second panel (Gmail-style)
 *
 * Shows institute logo + name at top, then the menu items for the active category.
 * On collapse, this panel hides entirely (only CategoryRail remains visible).
 * When collapsed, hovering a category rail item shows a flyout popover with the tabs.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { SidebarItemsType } from '@/types/layout-container/layout-container-types';
import { SidebarItem } from './sidebar-item';
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import {
    Question,
    WhatsappLogo,
    EnvelopeSimple,
    Tabs,
    UserGear,
    ChalkboardTeacher,
    Student,
    TextAa,
    Bell,
    CreditCard,
    Gift,
    BookOpen,
    Sliders,
    Certificate,
    Layout,
    Brain,
    Money,
    GearSix,
    type IconProps,
} from '@phosphor-icons/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { goToMailSupport, goToWhatsappSupport } from '@/lib/utils';
import { getRecentTabs, type RecentTabEntry } from './recent-tabs-store';
import { Link, useNavigate } from '@tanstack/react-router';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { getCategoryColors } from './sidebar-colors';
import type { CategoryId } from './category-rail';
import { useIsMobile } from '@/hooks/use-mobile';
import type { DisplaySettingsData } from '@/types/display-settings';
import { getAvailableSettingsTabs } from '@/routes/settings/-utils/utils';

interface SidebarPanelProps {
    isOpen: boolean;
    activeCategory: CategoryId;
    sidebarItems: SidebarItemsType[];
    instituteLogo: string;
    instituteName: string;
    roleDisplay: DisplaySettingsData | null;
    onItemClick?: () => void;
    sidebarComponent?: React.ReactNode;
    showSupportButton?: boolean;
    instituteId?: string;
    isPartnershipLinkage?: boolean;
    mainInstituteLogoUrl?: string;
    mainInstituteName?: string;
}

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
    isOpen,
    activeCategory,
    sidebarItems,
    instituteLogo,
    instituteName,
    roleDisplay,
    onItemClick,
    sidebarComponent,
    showSupportButton = true,
    instituteId,
    isPartnershipLinkage,
    mainInstituteLogoUrl,
    mainInstituteName,
}) => {
    const navigate = useNavigate();
    const router = useRouter();
    const currentRoute = router.state.location.pathname;
    const isMobile = useIsMobile();

    // Filter items by active category
    const filteredItems =
        activeCategory === 'RECENT'
            ? [] // Recent items are handled separately
            : sidebarItems.filter((item) => {
                if (item.id === 'settings') return false; // Settings is on the rail
                const show = item.showForInstitute;
                const category = item.category || 'CRM';
                return (!show || show === instituteId) && category === activeCategory;
            });

    const recentTabs = activeCategory === 'RECENT' ? getRecentTabs() : [];

    // On mobile, the panel is always rendered at full width inside the Sheet
    const panelOpen = isMobile ? true : isOpen;

    // Settings tabs for the SETTINGS category
    const settingsTabs = activeCategory === 'SETTINGS' ? getAvailableSettingsTabs() : [];
    // Reactively read the selectedTab search param from the URL
    const routerState = useRouterState({ select: (s) => s.location.search });
    const activeSettingsTab = (routerState as unknown as Record<string, string>)?.selectedTab || 'tab';

    return (
        <div
            className={cn(
                'flex h-full flex-col border-r border-neutral-200 bg-neutral-50',
                'transition-[width,opacity] duration-200 ease-in-out',
                'overflow-hidden'
            )}
            style={{
                width: panelOpen ? 250 : 0,
                opacity: panelOpen ? 1 : 0,
                minWidth: panelOpen ? 250 : 0,
            }}
        >
            {/* Logo + Institute Name Header */}
            <div className="flex flex-col border-b border-neutral-200">
                <div
                    className="flex cursor-pointer items-center gap-2.5 px-4 py-4"
                    onClick={() => {
                        navigate({ to: '/dashboard' });
                        onItemClick?.();
                    }}
                >
                    {instituteLogo && (
                        <img
                            src={instituteLogo}
                            alt="logo"
                            className="h-8 w-auto max-w-[36px] flex-shrink-0 object-contain"
                        />
                    )}
                    <span className="truncate text-sm font-semibold text-neutral-800" title={instituteName}>
                        {instituteName}
                    </span>
                </div>
                {isPartnershipLinkage && mainInstituteName && (
                    <div className="flex items-center gap-2 px-4 pb-3 pl-14 text-neutral-500">
                        <span className="text-[10px] font-medium text-neutral-500 whitespace-nowrap">
                            Powered by
                        </span>
                        {mainInstituteLogoUrl ? (
                            <div className="flex shrink-0 items-center justify-center overflow-hidden rounded">
                                <img
                                    src={mainInstituteLogoUrl}
                                    alt={mainInstituteName}
                                    className="h-6 w-auto object-contain max-w-[100px]"
                                    aria-hidden
                                />
                            </div>
                        ) : (
                            <span className="text-xs font-bold text-neutral-700 truncate">
                                {mainInstituteName}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="mx-3 my-1" />

            {/* Menu Items */}
            <div className="sidebar-content flex-1 overflow-y-auto px-1.5 py-2">
                {sidebarComponent ? (
                    sidebarComponent
                ) : activeCategory === 'SETTINGS' ? (
                    <SettingsTabsList
                        tabs={settingsTabs}
                        activeTab={activeSettingsTab}
                        onItemClick={onItemClick}
                    />
                ) : activeCategory === 'RECENT' ? (
                    <RecentTabsList
                        entries={recentTabs}
                        currentRoute={currentRoute}
                        onItemClick={onItemClick}
                    />
                ) : (
                    <SidebarMenu className="flex flex-col gap-0.5">
                        {filteredItems.map((obj, key) => (
                            <SidebarMenuItem
                                key={key}
                                id={obj.id}
                                onClick={() => {
                                    if (!obj.subItems) {
                                        onItemClick?.();
                                    }
                                }}
                            >
                                <SidebarItem {...obj} />
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                )}
            </div>

            {/* Support button at bottom */}
            {showSupportButton && !currentRoute.includes('slides') && (
                <div className="mt-auto border-t border-neutral-200 px-1.5 py-2">
                    <SupportOptions />
                </div>
            )}
        </div>
    );
};

// ─── Recent Tabs List ──────────────────────────────────────────

interface RecentTabsListProps {
    entries: RecentTabEntry[];
    currentRoute: string;
    onItemClick?: () => void;
}

const RecentTabsList: React.FC<RecentTabsListProps> = ({
    entries,
    currentRoute,
    onItemClick,
}) => {
    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                <p className="text-xs text-neutral-400">No recent tabs</p>
                <p className="text-[10px] text-neutral-300">
                    Navigate to pages and they'll appear here
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Recently Visited
            </p>
            {entries.map((entry, idx) => {
                const colors = getCategoryColors(entry.category);
                const isActive = currentRoute.includes(entry.route);
                return (
                    <Link
                        key={`${entry.route}-${idx}`}
                        to={entry.route}
                        onClick={() => onItemClick?.()}
                        className={cn(
                            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                            isActive
                                ? cn(colors.pillBg, colors.pillText, 'font-medium')
                                : 'text-neutral-600 hover:bg-neutral-100'
                        )}
                    >
                        {/* Category dot */}
                        <span
                            className={cn(
                                'h-1.5 w-1.5 flex-shrink-0 rounded-full',
                                colors.text.replace('text-', 'bg-')
                            )}
                        />
                        <span className="truncate">{entry.label}</span>
                    </Link>
                );
            })}
        </div>
    );
};

// ─── Support Options ───────────────────────────────────────────

function SupportOptions() {
    const [open, setOpen] = React.useState(false);
    const [hover, setHover] = React.useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white"
                    onMouseEnter={() => setHover(true)}
                    onMouseLeave={() => setHover(false)}
                >
                    <Question
                        className={cn('size-5', hover ? 'text-teal-600' : 'text-neutral-400')}
                        weight={hover ? 'fill' : 'regular'}
                    />
                    <span
                        className={cn(
                            'text-sm transition-colors',
                            hover ? 'text-teal-600' : 'text-neutral-500'
                        )}
                    >
                        Support
                    </span>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" side="right" align="end">
                <Command>
                    <CommandList>
                        <CommandGroup>
                            <CommandItem>
                                <div
                                    role="button"
                                    className="flex w-full cursor-pointer items-center gap-2"
                                    onClick={goToWhatsappSupport}
                                >
                                    <WhatsappLogo size={16} />
                                    WhatsApp
                                </div>
                            </CommandItem>
                            <CommandItem>
                                <div
                                    role="button"
                                    className="flex w-full cursor-pointer items-center gap-2"
                                    onClick={goToMailSupport}
                                >
                                    <EnvelopeSimple size={16} />
                                    Mail us
                                </div>
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// ─── Settings Tabs List ────────────────────────────────────────

/** Map settings tab keys to unique icons */
const SETTINGS_TAB_ICONS: Record<string, React.FC<IconProps>> = {
    tab: Tabs,
    adminDisplay: UserGear,
    teacherDisplay: ChalkboardTeacher,
    studentDisplay: Student,
    naming: TextAa,
    notification: Bell,
    payment: CreditCard,
    referral: Gift,
    course: BookOpen,
    customFields: Sliders,
    certificates: Certificate,
    templates: Layout,
    aiSettings: Brain,
    feeManagement: Money,
};

interface SettingsTabsListProps {
    tabs: { tab: string; value: string; component: React.FC<any> }[];
    activeTab: string;
    onItemClick?: () => void;
}

const SettingsTabsList: React.FC<SettingsTabsListProps> = ({
    tabs,
    activeTab,
    onItemClick,
}) => {
    return (
        <div className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Settings
            </p>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.tab;
                const Icon = SETTINGS_TAB_ICONS[tab.tab] || GearSix;
                return (
                    <Link
                        key={tab.tab}
                        to="/settings"
                        search={{ selectedTab: tab.tab }}
                        onClick={() => onItemClick?.()}
                        className={cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                            isActive
                                ? 'bg-primary-50 font-medium text-neutral-800'
                                : 'text-neutral-600 hover:bg-neutral-100'
                        )}
                    >
                        <Icon
                            size={16}
                            weight={isActive ? 'fill' : 'regular'}
                            className={cn(
                                'shrink-0 transition-colors',
                                isActive ? 'text-neutral-800' : 'text-neutral-400'
                            )}
                        />
                        <span className="truncate">{tab.value}</span>
                    </Link>
                );
            })}
        </div>
    );
};
