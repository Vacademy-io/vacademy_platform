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
import { getSidebarItemsData, withSystemDefaults } from './utils';
import { useNamingSettingsVersion } from '@/hooks/useNamingSettingsVersion';
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
import { getEffectiveInstituteLogoFileId, getValidSelectedSubOrgId, getSelectedSubOrgLinkageType } from '@/lib/auth/facultyAccessUtils';
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

    // Subscribe to naming-settings changes so the sidebar re-renders with
    // the new terms the moment they are saved on the settings page.
    useNamingSettingsVersion();

    // IMPORTANT: use the *validated* selector here. The plain getter returns
    // whatever's in localStorage, which can be a stale id from a previous session
    // or a sub-org an institute admin only *visited* (not joined). Without this
    // gate the sidebar would silently flip to sub-org branding for an institute
    // admin who has no FSPSSM access. getValidSelectedSubOrgId self-heals stale
    // entries so future renders settle on parent branding without manual clears.
    const selectedSubOrgId = getValidSelectedSubOrgId();
    const subOrgLinkageType = getSelectedSubOrgLinkageType();
    const isPartnershipLinkage = subOrgLinkageType === 'PARTNERSHIP' || subOrgLinkageType === 'SUB_ORG';

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

        // Collect every category whose tab/sub-tab/custom-tab matches the current
        // route. Custom tabs (saved in roleDisplay.sidebar) participate too — without
        // this, an LMS custom tab pointing to a CRM route loses to the static CRM
        // entry and the wrong category gets activated.
        const findMatchingCategories = (): Array<'CRM' | 'LMS' | 'AI'> => {
            if (isVoltSubdomain) return ['LMS'];
            const hits: Array<'CRM' | 'LMS' | 'AI'> = [];
            const push = (cat?: 'CRM' | 'LMS' | 'AI') => {
                const c = cat || 'CRM';
                if (!hits.includes(c)) hits.push(c);
            };

            for (const item of getSidebarItemsData()) {
                if (item.id === 'settings') continue;
                if (item.to && currentRoute.startsWith(item.to)) push(item.category);
                if (item.subItems) {
                    for (const sub of item.subItems) {
                        const link = sub.subItemLink || '';
                        if (link && currentRoute.startsWith(link)) push(item.category);
                    }
                }
            }

            // Custom tabs from the saved role config — these have their own category.
            const customTabs = roleDisplay?.sidebar?.filter((t) => t.isCustom) || [];
            for (const t of customTabs) {
                if (t.route && currentRoute.startsWith(t.route)) {
                    push(t.category as 'CRM' | 'LMS' | 'AI' | undefined);
                }
                for (const s of t.subTabs || []) {
                    if (s.route && currentRoute.startsWith(s.route)) {
                        push(t.category as 'CRM' | 'LMS' | 'AI' | undefined);
                    }
                }
            }

            return hits;
        };

        const matches = findMatchingCategories();
        // Prefer a visible match; if none of the matches are visible, prefer the
        // default visible category from sidebarCategories; otherwise fall through.
        const visibleMatch = matches.find((c) => checkCategoryVisibility(c));
        let targetCategory: 'CRM' | 'LMS' | 'AI' | null = visibleMatch ?? null;

        if (!targetCategory && roleDisplay?.sidebarCategories) {
            // Find a visible category to land on. Try `default && visible`, then
            // any visible by order. Skipping plain `default` here — a category
            // that's marked default but hidden isn't a usable landing target.
            const cats = roleDisplay.sidebarCategories
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            const defVisible = cats.find((c) => c.default && c.visible !== false);
            const anyVisible = cats.find((c) => c.visible !== false);
            targetCategory = (defVisible?.id || anyVisible?.id || null) as
                | 'CRM'
                | 'LMS'
                | 'AI'
                | null;
        }

        if (targetCategory && activeCategory !== 'RECENT' && activeCategory !== 'SETTINGS') {
            setActiveCategory(targetCategory);
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
            : filterMenuItems(getSidebarItemsData(), data?.id || '', isTabVisible, isSubItemVisible);
        if (!roleDisplay) return base;

        // Build a lookup of what each sidebar item would look like with system
        // defaults (no naming-settings applied). Used below to distinguish
        // seeded cfg.label values from deliberate user customizations.
        const defaultItemsById = new Map(
            withSystemDefaults(() => getSidebarItemsData()).map((i) => [i.id, i])
        );

        const tabVis = new Map(roleDisplay.sidebar.map((t) => [t.id, t]));
        const mapped = base
            .filter((item) => {
                const cfg = tabVis.get(item.id);
                return cfg ? cfg.visible !== false : true;
            })
            .map((item) => {
                const cfg = tabVis.get(item.id);
                if (!cfg) return item;
                // To decide whether cfg.label is a stale seed or a real user
                // customization, compare it to the same item rendered with
                // system defaults (i.e. no naming-settings applied). Match =
                // seeded, fall back to dynamic item.title. Mismatch = user
                // explicitly customized the label, respect it.
                const defaultItem = defaultItemsById.get(item.id);
                const isSeededTitle = !cfg.label || cfg.label === defaultItem?.title;
                if (item.subItems && item.subItems.length > 0) {
                    const subVis = new Map((cfg.subTabs || []).map((s) => [s.id, s]));
                    const defaultSubsById = new Map(
                        (defaultItem?.subItems || []).map((s) => [s.subItemId, s])
                    );
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
                            const defaultSub = defaultSubsById.get(s.subItemId);
                            const isSeededSubLabel =
                                !c?.label || c.label === defaultSub?.subItem;
                            return {
                                ...s,
                                subItem: isSeededSubLabel
                                    ? s.subItem
                                    : (c?.label as string),
                                subItemLink: c?.route ?? s.subItemLink,
                                locked: c?.locked,
                            };
                        });
                    return {
                        ...item,
                        title: isSeededTitle ? item.title : (cfg.label as string),
                        to: cfg.route ?? item.to,
                        subItems: filteredSubs,
                        locked: cfg.locked,
                    };
                }
                return {
                    ...item,
                    title: isSeededTitle ? item.title : (cfg.label as string),
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
                // Honor the category the admin chose when creating the custom tab.
                // Without this, the panel filter defaults to 'CRM' and hides
                // LMS/AI custom tabs even when they were saved with the right category.
                category: t.category,
            }));
        return ([...mapped, ...customTabs] as SidebarItemsType[]).sort((a, b) => {
            const ao = tabVis.get(a.id)?.order ?? 0;
            const bo = tabVis.get(b.id)?.order ?? 0;
            return ao - bo;
        });
    })();

    // Logo
    const { getPublicUrl } = useFileUpload();
    const { instituteLogo, setInstituteLogo, brandingDisplay } = useInstituteLogoStore();

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
                                hideInstituteName={brandingDisplay.hideInstituteName}
                                logoWidthPx={brandingDisplay.logoWidthPx}
                                logoHeightPx={brandingDisplay.logoHeightPx}
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
                        hideInstituteName={brandingDisplay.hideInstituteName}
                        logoWidthPx={brandingDisplay.logoWidthPx}
                        logoHeightPx={brandingDisplay.logoHeightPx}
                    />
                </TooltipProvider>
            </SidebarContent>
        </Sidebar>
    );
};
