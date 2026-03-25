import { MySidebar } from './sidebar/mySidebar';
import { useSidebar } from '@/components/ui/sidebar';
import { Navbar } from './top-navbar.tsx/navbar';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { InternalSideBar } from './internal-sidebar/internalSideBar';
import { StudentSidebarProvider } from '@/routes/manage-students/students-list/-providers/student-sidebar-provider';
import { InternalSidebarComponent } from './internal-sidebar/internalSidebarComponent';
import { getDisplaySettingsFromCache } from '@/services/display-settings';
import { ADMIN_DISPLAY_SETTINGS_KEY, TEACHER_DISPLAY_SETTINGS_KEY } from '@/types/display-settings';
import { getTokenFromCookie, getUserRoles } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { hasFacultyAssignedPermission } from '@/lib/auth/facultyAccessUtils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

/**
 * New sidebar dimensions (Gmail-style two-bar):
 * - Rail:    64px (always visible on desktop)
 * - Panel:  250px (collapsible)
 * - Total expanded:  64 + 250 = 314px  (set via --sidebar-width in sidebar.tsx)
 * - Total collapsed: 64px (rail only)   (set via --sidebar-width-icon in sidebar.tsx)
 *
 * The shadcn <Sidebar> component handles its own spacer div via CSS variables,
 * so LayoutContainer no longer needs to manually reserve width.
 */

export const LayoutContainer = ({
    children,
    className,
    sidebarComponent,
    intrnalMargin = true,
    internalSideBar = false,
    sideBarList,
    sideBarData,
    internalSidebarComponent,
    hasInternalSidebarComponent = false,
    customSidebarControl = false,
    showMobileBackButton = false,
    internalSidebarMobileText,
}: {
    children?: React.ReactNode;
    className?: string;
    sidebarComponent?: React.ReactNode;
    intrnalMargin?: boolean;
    internalSideBar?: boolean;
    sideBarList?: { value: string; id: string }[];
    sideBarData?: { title: string; listIconText: string; searchParam: string };
    hasInternalSidebarComponent?: boolean;
    internalSidebarComponent?: React.ReactNode;
    customSidebarControl?: boolean;
    showMobileBackButton?: boolean;
    internalSidebarMobileText?: string;
}) => {
    const { open, setOpen } = useSidebar();
    const isMobile = useIsMobile();
    const isTablet = useIsTablet();
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const roles = getUserRoles(accessToken);
    const isAdmin = roles.includes('ADMIN');
    const roleKey = isAdmin ? ADMIN_DISPLAY_SETTINGS_KEY : TEACHER_DISPLAY_SETTINGS_KEY;
    const roleDisplay = getDisplaySettingsFromCache(roleKey);
    const { instituteDetails } = useInstituteDetailsStore();
    const hasFacultyPermission = hasFacultyAssignedPermission(instituteDetails?.id);
    const showMainSidebar = roleDisplay?.ui?.showSidebar !== false;

    // Track previous sidebar config to detect actual changes vs re-renders
    const prevConfigRef = useRef<string | null>(null);

    useEffect(() => {
        // Skip automatic sidebar control if customSidebarControl is enabled
        if (customSidebarControl) return;

        // On mobile, sidebar is handled via Sheet (drawer)
        if (isMobile) return;

        // Build a config key — the effect should only fire when this changes
        const configKey = `${isTablet}-${internalSideBar}-${hasInternalSidebarComponent}`;
        if (prevConfigRef.current === configKey) return; // No config change, don't override
        prevConfigRef.current = configKey;

        // On tablet, always collapse the sidebar (show rail only)
        if (isTablet) {
            setOpen(false);
            return;
        }

        // On desktop, expand if no internal sidebar, collapse if there is one
        const shouldExpand = !(internalSideBar || hasInternalSidebarComponent);
        setOpen(shouldExpand);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        internalSideBar,
        hasInternalSidebarComponent,
        customSidebarControl,
        isMobile,
        isTablet,
    ]);

    return (
        <div className="flex min-h-screen w-full">
            {/* Main Sidebar — the <Sidebar> component handles its own spacer div */}
            {showMainSidebar && !isMobile && (
                <MySidebar sidebarComponent={sidebarComponent} />
            )}

            {/* Mobile Sidebar — rendered as Sheet/Drawer */}
            {showMainSidebar && isMobile && (
                <MySidebar sidebarComponent={sidebarComponent} />
            )}

            {/* Internal Sidebar */}
            {(hasInternalSidebarComponent || internalSideBar) && (
                <div
                    className={cn(
                        isMobile || isTablet
                            ? 'w-0 overflow-visible'
                            : 'sticky top-0 h-screen flex-shrink-0',
                        isTablet && 'lg:hidden xl:block'
                    )}
                >
                    {hasInternalSidebarComponent && internalSidebarComponent ? (
                        <InternalSidebarComponent
                            sidebarComponent={internalSidebarComponent}
                            mobileButtonText={internalSidebarMobileText}
                        />
                    ) : (
                        internalSideBar && (
                            <InternalSideBar sideBarList={sideBarList} sideBarData={sideBarData} />
                        )
                    )}
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex w-full min-w-0 flex-1 flex-col text-neutral-600">
                <Navbar showMobileBackButton={showMobileBackButton} />
                <StudentSidebarProvider>
                    <div
                        className={cn(
                            intrnalMargin
                                ? 'flex flex-1 flex-col p-2 sm:p-3 md:p-4 lg:m-7'
                                : 'm-0',
                            'overflow-x-hidden',
                            className
                        )}
                    >
                        {children}
                    </div>
                </StudentSidebarProvider>
            </div>
        </div>
    );
};
