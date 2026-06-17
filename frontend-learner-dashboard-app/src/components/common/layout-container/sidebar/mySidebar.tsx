import React, { useEffect, useMemo, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { sideBarStateType } from "../../../../types/layout-container-types";
import { SidebarItem } from "./sidebar-item";
import {
  HamBurgerSidebarItemsData,
  filterHamburgerMenuItemsWithPermissions,
  getTerminology,
  getTerminologyPlural,
} from "./utils";
import {
  ContentTerms,
  RoleTerms,
  SystemTerms,
} from "@/types/naming-settings";
import "./scrollbarStyle.css";
import useStore from "./useSidebar";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { getChatEnabled } from "@/services/chat/getChatEnabled";
import type { StudentSidebarTabConfig } from "@/types/student-display-settings";
import {
  House,
  BookOpen,
  NotePencil,
  Scroll,
  SquaresFour,
  Globe,
  GooglePlayLogo,
  AppStoreLogo,
  WindowsLogo,
  AppleLogo,
  SignOut,
  ChatCircle,
} from "@phosphor-icons/react";
import type {
  SidebarItemsType,
  subItemsType,
} from "../../../../types/layout-container-types";
import { useStudentPermissions } from "@/hooks/use-student-permissions";
import { useIsIOS } from "@/hooks/useIsIOS";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { Student } from "@/types/user/user-detail";
import { X } from "@phosphor-icons/react";

// Local letter-based icon factory for tabs without predefined icons
const createLetterIcon =
  (letter: string) =>
    ({ className }: { className?: string; weight?: unknown }) =>
    (
      <div
        className={`flex items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-800 ${className || ""
          }`}
        aria-hidden
      >
        <span className="text-caption leading-none font-medium uppercase">{letter}</span>
      </div>
    );

const humanizeText = (text: string) => {
  if (!text) return "";
  return text
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const MySidebar = ({
  sidebarComponent,
}: {
  sidebarComponent?: React.ReactNode;
}) => {
  const navigate = useNavigate();
  const { state, isMobile, toggleSidebar } = useSidebar();
  const isAndroid = Capacitor.getPlatform() === 'android';
  const {
    sideBarState,
    instituteName,
    instituteLogoFileUrl,
    homeIconClickRoute,
    playStoreAppLink,
    appStoreAppLink,
    windowsAppLink,
    macAppLink,
    learnerPortalUrl,
    subOrgName,
    subOrgLogoUrl,
    hideInstituteName,
    logoWidthPx,
    logoHeightPx,
  } = useStore();
  const handleInstituteLogoClick = () => {
    if (homeIconClickRoute) {
      window.location.href = homeIconClickRoute;
    }
  };

  const { permissions } = useStudentPermissions();
  const isIOS = useIsIOS();
  const [filteredSidebarItems, setFilteredSidebarItems] = useState<
    SidebarItemsType[]
  >([]);
  const [filteredHamburgerItems, setFilteredHamburgerItems] = useState(
    HamBurgerSidebarItemsData
  );
  const [hideSidebar, setHideSidebar] = useState<boolean>(false);
  const [studentData, setStudentData] = useState<Student | null>(null);

  // Identity footer: read the logged-in learner from Preferences (same
  // storage the hamburger sheet uses) so the sidebar can show who is
  // signed in and link to the profile screen.
  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const { value } = await Preferences.get({ key: "StudentDetails" });
        if (!value) return;
        const parsedData = JSON.parse(value);
        let studentDetails: Student | null = null;
        if (Array.isArray(parsedData)) {
          studentDetails = parsedData.length > 0 ? parsedData[0] : null;
        } else if (typeof parsedData === "object" && parsedData !== null) {
          studentDetails = parsedData;
        }
        if (studentDetails) setStudentData(studentDetails);
      } catch (error) {
        console.error("Error reading student details for sidebar:", error);
      }
    };
    fetchStudentData();
  }, []);

  const learnerDisplayName =
    studentData?.full_name?.trim() ||
    getTerminology(RoleTerms.Learner, SystemTerms.Learner);
  const learnerInitials =
    learnerDisplayName
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase() || "L";

  const iconByTabId: Record<string, unknown> = useMemo(
    () => ({
      dashboard: House,
      "learning-center": BookOpen,
      homework: NotePencil,
      "assessment-center": Scroll,
      chat: ChatCircle,
    }),
    []
  );

  const defaultRouteByTabId: Record<string, string> = useMemo(
    () => ({
      dashboard: "/dashboard",
      referral: "/referral",
      attendance: "/learning-centre/attendance",
      chat: "/chat",
    }),
    []
  );

  const labelByTabId: Record<string, string> = useMemo(
    () => ({
      dashboard: "Dashboard",
      "learning-center": "Learning Center",
      homework: "Homework",
      "assessment-center": "Assessment Centre",
      referral: "Referral",
      attendance: "Attendance",
      chat: "In-App Messages",
    }),
    []
  );

  const transformTabsToSidebarItems = (
    tabs: StudentSidebarTabConfig[]
  ): SidebarItemsType[] => {
    return tabs
      .filter((t) => t.visible !== false)
      .map<SidebarItemsType>((t) => {
        const hasSubTabs = (t.subTabs || []).some((s) => s.visible !== false);
        const subItems: subItemsType[] | undefined = hasSubTabs
          ? (t.subTabs || [])
            .filter((s) => s.visible !== false)
            .map((s) => {
              let subLabel = s.label;
              if (!subLabel && s.id === "live-classes") {
                subLabel = getTerminologyPlural(
                  ContentTerms.LiveSession,
                  SystemTerms.LiveSession
                );
              }
              return {
                subItem: subLabel || s.id,
                subItemLink: s.route || "/",
              };
            })
          : undefined;
        const computedLabel = (
          t.label ||
          labelByTabId[t.id] ||
          t.id ||
          ""
        ).trim();
        const firstLetter = (computedLabel.charAt(0) || "?").toUpperCase();
        return {
          icon: iconByTabId[t.id] || createLetterIcon(firstLetter),
          title: t.label || labelByTabId[t.id] || humanizeText(t.id),
          to: subItems
            ? undefined
            : t.route || defaultRouteByTabId[t.id] || "/",
          subItems,
        } as SidebarItemsType;
      });
  };

  // The Chat tab is gated on the institute's chat-enabled flag (chat is OFF
  // by default — see getChatEnabled, which fails closed). When chat is enabled
  // we inject a default visible chat tab right after the dashboard tab whenever
  // the settings omit it, so it appears in a sensible position without
  // depending on saved config. When chat is disabled we strip any chat tab the
  // saved config may have carried, so no entry point leaks through.
  const ensureChatTab = (
    tabs: StudentSidebarTabConfig[],
    chatEnabled: boolean
  ): StudentSidebarTabConfig[] => {
    if (!chatEnabled) return tabs.filter((t) => t.id !== "chat");
    if (tabs.some((t) => t.id === "chat")) return tabs;
    const dashboardIndex = tabs.findIndex((t) => t.id === "dashboard");
    const chatTab: StudentSidebarTabConfig = {
      id: "chat",
      label: "In-App Messages",
      route: "/chat",
      order: 0,
      visible: true,
    };
    const next = tabs.slice();
    next.splice(dashboardIndex >= 0 ? dashboardIndex + 1 : next.length, 0, chatTab);
    return next;
  };

  useEffect(() => {
    // Load display settings + chat-enabled flag and compute sidebar items.
    // getChatEnabled fails closed (chat hidden) when the flag is
    // unknown/loading/errored, matching chat being off by default.
    Promise.all([getStudentDisplaySettings(false), getChatEnabled()]).then(
      ([settings, chatEnabled]) => {
        const shouldHide = settings?.sidebar?.visible === false;
        setHideSidebar(!!shouldHide);
        const tabs = ensureChatTab(
          (settings?.sidebar?.tabs || []).slice(),
          chatEnabled
        );
        setFilteredSidebarItems(transformTabsToSidebarItems(tabs));
      }
    );

    if (sideBarState === sideBarStateType.HAMBURGER) {
      // Filter hamburger menu items based on permissions
      filterHamburgerMenuItemsWithPermissions(
        HamBurgerSidebarItemsData,
        permissions || {
          canViewProfile: false,
          canEditProfile: false,
          canDeleteProfile: false,
          canViewFiles: false,
          canViewReports: false,
        }
      ).then((data) => {
        setFilteredHamburgerItems(data);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sideBarState]);

  const isExpanded = state === "expanded";

  // Operator-configured logo dimensions only apply when the sidebar is
  // expanded — in icon-collapsed mode the rail has a fixed narrow width, so
  // a wide custom logo would overflow. Fall back to the default 28px square
  // in collapsed mode regardless of override.
  const hasCustomLogoDims =
    isExpanded && (logoWidthPx != null || logoHeightPx != null);
  // maxWidth: 100% caps the logo at the available sidebar width so an
  // admin-configured pixel width larger than the panel doesn't overflow —
  // it just fills the available space.
  const customLogoStyle: React.CSSProperties | undefined = hasCustomLogoDims
    ? {
        width: logoWidthPx ?? undefined,
        height: logoHeightPx ?? undefined,
        maxWidth: '100%',
      }
    : undefined;

  if (hideSidebar && !sidebarComponent) {
    return null;
  }

  return (
    <Sidebar
      side="left"
      collapsible={sidebarComponent ? "offcanvas" : "icon"}
      // Custom sidebars (the slides-viewer course tree) carry long slide
      // titles and a breadcrumb trail; give them a wider rail than the
      // standard nav sidebar.
      style={
        sidebarComponent
          ? ({ "--sidebar-width": "19rem" } as React.CSSProperties)
          : undefined
      }
    >
      <SidebarContent className={`sidebar-content flex flex-col bg-white dark:bg-neutral-900 py-1 transition-all  duration-200 ${isIOS ? 'mt-10' : ''} ease-in-out max-w-full w-full overflow-x-hidden`}>
        <SidebarHeader className="border-b border-border pb-2">
          {isAndroid && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Close sidebar"
              className="absolute top-4 mt-6 right-4 z-10 size-8 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={18} />
            </button>
          )}
          <SidebarMenu className={`px-1 ${isAndroid || isIOS ? 'mt-12' : ''}`}>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="default"
                className={cn(
                  "h-auto min-h-10 gap-3 rounded-lg data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                  "group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-1",
                  "[.ui-play_&]:rounded-xl",
                  // When the institute name is hidden and we're not in
                  // sub-org mode, center the logo in the expanded sidebar
                  // so a wide custom-sized logo fills the sheet area.
                  hideInstituteName && !subOrgName && isExpanded && "justify-center"
                )}
                onClick={
                  homeIconClickRoute ? handleInstituteLogoClick : undefined
                }
              >
                {subOrgName ? (
                  /* Sub-org branding: show sub-org logo/name + "Powered by parent" */
                  <div className="flex flex-col gap-1 py-1 w-full">
                    <div className="flex h-10 items-center gap-3">
                      <div className="flex aspect-square size-8 items-center justify-center rounded-md text-sidebar-primary-foreground shrink-0">
                        {subOrgLogoUrl ? (
                          <img src={subOrgLogoUrl} alt="Logo" className="size-8 object-contain rounded-md bg-white" />
                        ) : (
                          <div className="size-8 rounded-md bg-primary-50 dark:bg-neutral-800 flex items-center justify-center text-caption font-semibold text-primary-500 dark:text-neutral-200">
                            {(subOrgName[0] || "S").toUpperCase()}
                          </div>
                        )}
                      </div>
                      {isExpanded && (
                        <span className="truncate text-subtitle font-semibold">
                          {subOrgName}
                        </span>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="flex items-center gap-1.5 pl-11">
                        <span className="text-caption text-muted-foreground whitespace-nowrap">Powered by</span>
                        {!isNullOrEmptyOrUndefined(instituteLogoFileUrl) ? (
                          <img src={instituteLogoFileUrl} alt={instituteName} className="h-4 w-auto max-w-20 object-contain" />
                        ) : (
                          <span className="text-caption font-semibold text-muted-foreground truncate">{instituteName}</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Default: parent institute branding */
                  <>
                    <div
                      className={
                        hasCustomLogoDims
                          ? "flex items-center justify-center text-sidebar-primary-foreground shrink-0"
                          : "flex aspect-square size-8 items-center justify-center rounded-md text-sidebar-primary-foreground shrink-0"
                      }
                      style={customLogoStyle}
                    >
                      {!isNullOrEmptyOrUndefined(instituteLogoFileUrl) ? (
                        <img
                          src={instituteLogoFileUrl}
                          alt="Logo"
                          className={
                            hasCustomLogoDims
                              ? "object-contain rounded-md bg-white"
                              : "size-8 object-contain rounded-md bg-white"
                          }
                          style={customLogoStyle}
                        />
                      ) : (
                        <div
                          className={
                            hasCustomLogoDims
                              ? "rounded-md bg-primary-50 dark:bg-neutral-800 flex items-center justify-center text-caption font-semibold text-primary-500 dark:text-neutral-200"
                              : "size-8 rounded-md bg-primary-50 dark:bg-neutral-800 flex items-center justify-center text-caption font-semibold text-primary-500 dark:text-neutral-200"
                          }
                          style={customLogoStyle}
                        >
                          {(instituteName?.[0] || "I").toUpperCase()}
                        </div>
                      )}
                    </div>
                    {!hideInstituteName && (
                      <div className="grid h-10 flex-1 content-center text-left leading-tight">
                        <span className="truncate text-subtitle font-semibold">
                          {instituteName}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarMenu
          className={`flex flex-col space-y-1 px-2 flex-1 transition-all duration-200 max-w-full w-full overflow-x-hidden ${isExpanded ? "items-stretch" : "items-center"
            }`}
        >
          {sidebarComponent
            ? sidebarComponent
            : (() => {
              const items =
                sideBarState === sideBarStateType.HAMBURGER
                  ? filteredHamburgerItems
                  : filteredSidebarItems;

              return items.map((obj, key) => (
                <div
                  key={key}
                  className="animate-slide-in-left max-w-full w-full"
                  style={{
                    animationDelay: `${key * 30}ms`,
                  }}
                >
                  <SidebarItem
                    icon={obj.icon}
                    subItems={
                      obj.subItems as
                      | { subItem: string; subItemLink: string }[]
                      | undefined
                    }
                    title={obj.title}
                    to={(obj.to || "/") as string}
                  />
                </div>
              ));
            })()}
        </SidebarMenu>
      </SidebarContent>
      {(playStoreAppLink ||
        appStoreAppLink ||
        windowsAppLink ||
        macAppLink ||
        learnerPortalUrl ||
        studentData) && (
          <SidebarFooter className="border-t border-border">
            {(playStoreAppLink ||
              appStoreAppLink ||
              windowsAppLink ||
              macAppLink ||
              learnerPortalUrl) &&
            ((state === "expanded" || isMobile) ? (
              <div className="flex flex-col gap-2 px-2">
                <span className="text-caption font-semibold uppercase text-muted-foreground tracking-wider pl-1 [.ui-play_&]:font-black [.ui-play_&]:text-primary-500">
                  Apps & Portals
                </span>
                <div className="flex flex-wrap gap-1">
                  {learnerPortalUrl && (
                    <a
                      href={learnerPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors [.ui-play_&]:rounded-full [.ui-play_&]:bg-primary-100 [.ui-play_&]:hover:bg-primary-200 [.ui-play_&]:border-2 [.ui-play_&]:border-primary-200 [.ui-play_&]:shadow-play-press"
                      title="Web Portal"
                    >
                      <Globe className="h-5 w-5" weight="duotone" />
                    </a>
                  )}
                  {playStoreAppLink && (
                    <a
                      href={playStoreAppLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors [.ui-play_&]:rounded-full [.ui-play_&]:bg-primary-100 [.ui-play_&]:hover:bg-primary-200 [.ui-play_&]:border-2 [.ui-play_&]:border-primary-200 [.ui-play_&]:shadow-play-press"
                      title="Android App"
                    >
                      <GooglePlayLogo className="h-5 w-5 text-green-600" weight="fill" />
                    </a>
                  )}
                  {appStoreAppLink && (
                    <a
                      href={appStoreAppLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors [.ui-play_&]:rounded-full [.ui-play_&]:bg-primary-100 [.ui-play_&]:hover:bg-primary-200 [.ui-play_&]:border-2 [.ui-play_&]:border-primary-200 [.ui-play_&]:shadow-play-press"
                      title="iOS App"
                    >
                      <AppStoreLogo className="h-5 w-5 text-sky-600" weight="fill" />
                    </a>
                  )}
                  {windowsAppLink && (
                    <a
                      href={windowsAppLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors [.ui-play_&]:rounded-full [.ui-play_&]:bg-primary-100 [.ui-play_&]:hover:bg-primary-200 [.ui-play_&]:border-2 [.ui-play_&]:border-primary-200 [.ui-play_&]:shadow-play-press"
                      title="Windows App"
                    >
                      <WindowsLogo className="h-5 w-5 text-blue-600" weight="fill" />
                    </a>
                  )}
                  {macAppLink && (
                    <a
                      href={macAppLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors [.ui-play_&]:rounded-full [.ui-play_&]:bg-primary-100 [.ui-play_&]:hover:bg-primary-200 [.ui-play_&]:border-2 [.ui-play_&]:border-primary-200 [.ui-play_&]:shadow-play-press"
                      title="Mac App"
                    >
                      <AppleLogo className="h-5 w-5 text-neutral-800 dark:text-neutral-200" weight="fill" />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <SidebarMenu>
                <SidebarMenuItem>
                  <Popover>
                    <PopoverTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground justify-center"
                        tooltip="Apps & Portals"
                      >
                        <SquaresFour weight="duotone" className="h-5 w-5" />
                      </SidebarMenuButton>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1 min-w-12" side="right" align="end">
                      <div className="flex flex-col gap-1 items-center">
                        {learnerPortalUrl && (
                          <a
                            href={learnerPortalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors"
                            title="Web Portal"
                          >
                            <Globe className="h-5 w-5" weight="duotone" />
                          </a>
                        )}
                        {playStoreAppLink && (
                          <a
                            href={playStoreAppLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors"
                            title="Android App"
                          >
                            <GooglePlayLogo className="h-5 w-5 text-green-600" weight="fill" />
                          </a>
                        )}
                        {appStoreAppLink && (
                          <a
                            href={appStoreAppLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors"
                            title="iOS App"
                          >
                            <AppStoreLogo className="h-5 w-5 text-sky-600" weight="fill" />
                          </a>
                        )}
                        {windowsAppLink && (
                          <a
                            href={windowsAppLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors"
                            title="Windows App"
                          >
                            <WindowsLogo className="h-5 w-5 text-blue-600" weight="fill" />
                          </a>
                        )}
                        {macAppLink && (
                          <a
                            href={macAppLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors"
                            title="Mac App"
                          >
                            <AppleLogo className="h-5 w-5 text-neutral-800 dark:text-neutral-200" weight="fill" />
                          </a>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </SidebarMenuItem>
              </SidebarMenu>
            ))}
            {studentData &&
              (state === "expanded" || isMobile ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/user-profile" })}
                    className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.ui-play_&]:rounded-xl"
                  >
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-caption font-semibold text-primary-500"
                    >
                      {learnerInitials}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body font-medium">
                      {learnerDisplayName}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/logout" })}
                    aria-label="Log out"
                    title="Log out"
                    className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.ui-play_&]:rounded-xl"
                  >
                    <SignOut className="size-5" weight="duotone" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/user-profile" })}
                    aria-label="Open profile"
                    title={learnerDisplayName}
                    className="flex size-10 items-center justify-center rounded-lg hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.ui-play_&]:rounded-xl"
                  >
                    <span
                      aria-hidden
                      className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-caption font-semibold text-primary-500"
                    >
                      {learnerInitials}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/logout" })}
                    aria-label="Log out"
                    title="Log out"
                    className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.ui-play_&]:rounded-xl"
                  >
                    <SignOut className="size-5" weight="duotone" />
                  </button>
                </div>
              ))}
          </SidebarFooter>
        )}
    </Sidebar>
  );
};
