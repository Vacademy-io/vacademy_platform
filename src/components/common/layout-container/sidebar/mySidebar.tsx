/**
 * MySidebar — Gmail-style two-bar sidebar
 *
 * Layout:
 * ┌──────────┬──────────────────────────────┐
 * │ Rail     │ Panel                         │
 * │ (64px)   │ (250px, collapsible)          │
 * │          │                               │
 * │ [CRM]    │ [Logo] Institute Name         │
 * │ [LMS]    │ ──────────────                │
 * │ [AI]     │ Dashboard          (pill)     │
 * │ ───      │ Manage Institute     ▾        │
 * │ [Recent] │   ├── Batches                 │
 * │          │   └── Sessions                │
 * │          │ ────── divider ──────         │
 * │          │ Settings                      │
 * │          │                               │
 * │          │ ❓ Support                    │
 * └──────────┴──────────────────────────────┘
 *
 * On collapse: Only the Rail stays. Hovering a rail category shows a flyout
 * popover with the tabs for that category.
 */

import React, { useEffect, useState } from 'react';
import {
    Sidebar,
    SidebarContent,
    useSidebar,
} from '@/components/ui/sidebar';
import {
    SidebarStateType,
    SidebarItemsType,
} from '../../../../types/layout-container/layout-container-types';
import { SidebarItemsData } from './utils';
import './scrollbarStyle.css';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { useInstituteQuery, getSubOrgInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { filterMenuItems } from './helper';
import { getTokenFromCookie, getUserRoles } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import {
    ADMIN_DISPLAY_SETTINGS_KEY,
    TEACHER_DISPLAY_SETTINGS_KEY,
    type DisplaySettingsData,
} from '@/types/display-settings';
import { getDisplaySettings, getDisplaySettingsFromCache } from '@/services/display-settings';
import { useFileUpload } from '@/hooks/use-file-upload';
import { cn } from '@/lib/utils';
import { useNavigate, useRouter } from '@tanstack/react-router';
import useInstituteLogoStore from './institutelogo-global-zustand';
import { useTabSettings } from '@/hooks/use-tab-settings';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { getEffectiveInstituteLogoFileId, getSelectedSubOrgId, getSelectedSubOrgLinkageType } from '@/lib/auth/facultyAccessUtils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';

import { Lightning } from '@phosphor-icons/react';
import { CategoryRail, type CategoryId } from './category-rail';
import { SidebarPanel } from './sidebar-panel';

const voltSidebarData: SidebarItemsType[] = [
    {
        icon: Lightning,
        title: 'Volt',
        id: 'volt',
        to: '/study-library/volt',
    },
];

export const MySidebar = ({ sidebarComponent }: { sidebarComponent?: React.ReactNode }) => {
    const navigate = useNavigate();
    const {
        state,
        openMobile,
        setOpenMobile,
    }: SidebarStateType & { openMobile: boolean; setOpenMobile: (open: boolean) => void } =
        useSidebar();
    const { data, isLoading } = useSuspenseQuery(useInstituteQuery());
    const router = useRouter();
    const currentRoute = router.state.location.pathname;
    const { isTabVisible, isSubItemVisible } = useTabSettings();
    const isMobile = useIsMobile();

    const [isVoltSubdomain, setIsVoltSubdomain] = useState(false);
    const [activeCategory, setActiveCategory] = useState<CategoryId>('CRM');
    const [roleDisplay, setRoleDisplay] = useState<DisplaySettingsData | null>(null);
    const [mainInstituteLogoUrl, setMainInstituteLogoUrl] = useState<string>('');

    const selectedSubOrgId = getSelectedSubOrgId();
    const isPartnershipLinkage = getSelectedSubOrgLinkageType() === 'PARTNERSHIP';

    const { data: subOrgInstituteDetails } = useQuery({
        ...getSubOrgInstituteQuery(selectedSubOrgId ?? null),
        enabled: !!selectedSubOrgId,
    });

    useEffect(() => {
        setIsVoltSubdomain(
            typeof window !== 'undefined' && window.location.hostname.startsWith('volt.')
        );
    }, []);

    // Sync active category with current route
    useEffect(() => {
        // If on /settings, always show as SETTINGS category
        if (currentRoute.startsWith('/settings')) {
            setActiveCategory('SETTINGS');
            return;
        }

        const checkCategoryVisibility = (cat: 'CRM' | 'LMS' | 'AI') => {
            if (!roleDisplay?.sidebarCategories) return true;
            const cfg = roleDisplay.sidebarCategories.find((c) => c.id === cat);
            return cfg ? cfg.visible !== false : true;
        };

        const findCategory = (): 'CRM' | 'LMS' | 'AI' | null => {
            if (isVoltSubdomain) return 'LMS';

            for (const item of SidebarItemsData) {
                if (item.id === 'settings') continue; // Skip settings — handled above
                const isActive = item.to ? currentRoute.startsWith(item.to) : false;
                if (isActive) return item.category || 'CRM';
                if (item.subItems) {
                    for (const sub of item.subItems) {
                        const link = sub.subItemLink || '';
                        if (link && currentRoute.startsWith(link)) {
                            return item.category || 'CRM';
                        }
                    }
                }
            }
            return null;
        };

        const matched = findCategory();
        let targetCategory = matched;

        if (targetCategory && !checkCategoryVisibility(targetCategory)) {
            targetCategory = null;
        }

        if (targetCategory) {
            // Don't override if user is browsing "Recent" or "Settings"
            if (activeCategory !== 'RECENT' && activeCategory !== 'SETTINGS') {
                setActiveCategory(targetCategory);
            }
        } else if (roleDisplay?.sidebarCategories) {
            const def = roleDisplay.sidebarCategories.find((c) => c.default);
            if (def && activeCategory !== 'RECENT' && activeCategory !== 'SETTINGS') setActiveCategory(def.id);
        }
    }, [currentRoute, isVoltSubdomain, roleDisplay]);

    // Load display settings
    useEffect(() => {
        const roleKey = getActiveRoleDisplaySettingsKey();
        const cached = getDisplaySettingsFromCache(roleKey);
        if (cached) {
            setRoleDisplay(cached);
        } else {
            getDisplaySettings(roleKey)
                .then(setRoleDisplay)
                .catch(() => setRoleDisplay(null));
        }
    }, []);

    // Compute final sidebar items (same logic as before)
    const finalSidebarItems = (() => {
        const base = isVoltSubdomain
            ? voltSidebarData
            : filterMenuItems(SidebarItemsData, data?.id || '', isTabVisible, isSubItemVisible);
        if (!roleDisplay) return base;

        const tabVis = new Map(roleDisplay.sidebar.map((t) => [t.id, t]));
        const mapped = base
            .filter((item) => {
                const cfg = tabVis.get(item.id);
                return cfg ? cfg.visible !== false : true;
            })
            .map((item) => {
                const cfg = tabVis.get(item.id);
                if (!cfg) return item;
                if (item.subItems && item.subItems.length > 0) {
                    const subVis = new Map((cfg.subTabs || []).map((s) => [s.id, s]));
                    const filteredSubs = item.subItems
                        .filter((s) => {
                            const c = subVis.get(s.subItemId);
                            return c ? c.visible !== false : true;
                        })
                        .sort((a, b) => {
                            const ao = subVis.get(a.subItemId)?.order ?? 0;
                            const bo = subVis.get(b.subItemId)?.order ?? 0;
                            return ao - bo;
                        })
                        .map((s) => {
                            const c = subVis.get(s.subItemId);
                            return {
                                ...s,
                                subItem: c?.label ?? s.subItem,
                                subItemLink: c?.route ?? s.subItemLink,
                                locked: c?.locked,
                            };
                        });
                    return {
                        ...item,
                        title: cfg.label ?? item.title,
                        to: cfg.route ?? item.to,
                        subItems: filteredSubs,
                        locked: cfg.locked,
                    };
                }
                return {
                    ...item,
                    title: cfg.label ?? item.title,
                    to: cfg.route ?? item.to,
                    locked: cfg.locked,
                };
            })
            .sort((a, b) => {
                const ao = tabVis.get(a.id)?.order ?? 0;
                const bo = tabVis.get(b.id)?.order ?? 0;
                return ao - bo;
            });

        // Add custom tabs
        const baseIds = new Set(base.map((b) => b.id));
        const customTabs: SidebarItemsType[] = roleDisplay.sidebar
            .filter((t) => t.isCustom && t.visible !== false && !baseIds.has(t.id))
            .map((t) => ({
                icon: (() => null) as unknown as SidebarItemsType['icon'],
                title: t.label || t.id,
                to: t.route,
                id: t.id,
                locked: t.locked,
            }));
        return ([...mapped, ...customTabs] as SidebarItemsType[]).sort((a, b) => {
            const ao = tabVis.get(a.id)?.order ?? 0;
            const bo = tabVis.get(b.id)?.order ?? 0;
            return ao - bo;
        });
    })();

    // Logo
    const { getPublicUrl } = useFileUpload();
    const { instituteLogo, setInstituteLogo } = useInstituteLogoStore();

    useEffect(() => {
        const timer = setTimeout(() => {
            const fetchPublicUrl = async () => {
                const effectiveLogoId = subOrgInstituteDetails?.institute_logo_file_id
                    ? subOrgInstituteDetails.institute_logo_file_id
                    : getEffectiveInstituteLogoFileId(data?.institute_logo_file_id || undefined);

                if (effectiveLogoId) {
                    const publicUrl = await getPublicUrl(effectiveLogoId);
                    setInstituteLogo(publicUrl || '');
                } else {
                    setInstituteLogo('');
                }

                if (isPartnershipLinkage && data?.institute_logo_file_id) {
                    const mainUrl = await getPublicUrl(data.institute_logo_file_id);
                    setMainInstituteLogoUrl(mainUrl || '');
                } else {
                    setMainInstituteLogoUrl('');
                }
            };
            fetchPublicUrl();
        }, 300);
        return () => clearTimeout(timer);
    }, [data?.institute_logo_file_id, subOrgInstituteDetails?.institute_logo_file_id, getPublicUrl, setInstituteLogo, currentRoute, isPartnershipLinkage]);

    if (isLoading) return <DashboardLoader />;
    if (roleDisplay?.ui?.showSidebar === false) return null;

    const isPanelOpen = state === 'expanded';
    const showSupportButton = roleDisplay?.ui?.showSupportButton !== false;

    const effectiveInstituteName = subOrgInstituteDetails?.institute_name
        ? subOrgInstituteDetails.institute_name
        : (data?.institute_name || '');

    // ─── Mobile: Sheet/Drawer ──────────────────────────────────
    if (isMobile) {
        return (
            <Sheet open={openMobile} onOpenChange={setOpenMobile}>
                <SheetContent side="left" className="w-[310px] border-r p-0">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Navigation Menu</SheetTitle>
                    </SheetHeader>
                    <TooltipProvider delayDuration={0}>
                        <div className="flex h-full">
                            {/* Category Rail */}
                            <CategoryRail
                                activeCategory={activeCategory}
                                onCategoryChange={setActiveCategory}
                                roleDisplay={roleDisplay}
                                sidebarItems={finalSidebarItems}
                                instituteId={data?.id}
                            />

                            {/* Panel */}
                            <SidebarPanel
                                isOpen={true}
                                activeCategory={activeCategory}
                                sidebarItems={finalSidebarItems}
                                instituteLogo={instituteLogo}
                                instituteName={effectiveInstituteName}
                                roleDisplay={roleDisplay}
                                onItemClick={() => setOpenMobile(false)}
                                sidebarComponent={sidebarComponent}
                                showSupportButton={showSupportButton}
                                instituteId={data?.id}
                                isPartnershipLinkage={isPartnershipLinkage}
                                mainInstituteLogoUrl={mainInstituteLogoUrl}
                                mainInstituteName={data?.institute_name || ''}
                            />
                        </div>
                    </TooltipProvider>
                </SheetContent>
            </Sheet>
        );
    }

    // ─── Desktop: Two-bar sidebar ──────────────────────────────
    return (
        <Sidebar collapsible="icon" className="z-20 !border-0">
            <SidebarContent
                className={cn(
                    'sidebar-content !flex !flex-row !gap-0 border-r-0 bg-transparent !overflow-hidden py-0',
                )}
            >
                <TooltipProvider delayDuration={0}>
                    {/* Left: Category Rail (always visible) */}
                    <CategoryRail
                        activeCategory={activeCategory}
                        onCategoryChange={setActiveCategory}
                        roleDisplay={roleDisplay}
                        sidebarItems={finalSidebarItems}
                        instituteId={data?.id}
                    />

                    {/* Right: Panel (always mounted, animates width) */}
                    <SidebarPanel
                        isOpen={isPanelOpen}
                        activeCategory={activeCategory}
                        sidebarItems={finalSidebarItems}
                        instituteLogo={instituteLogo}
                        instituteName={effectiveInstituteName}
                        roleDisplay={roleDisplay}
                        sidebarComponent={sidebarComponent}
                        showSupportButton={showSupportButton}
                        instituteId={data?.id}
                        isPartnershipLinkage={isPartnershipLinkage}
                        mainInstituteLogoUrl={mainInstituteLogoUrl}
                        mainInstituteName={data?.institute_name || ''}
                    />
                </TooltipProvider>
            </SidebarContent>
        </Sidebar>
    );
};
