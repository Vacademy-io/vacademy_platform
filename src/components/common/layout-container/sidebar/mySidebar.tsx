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

import {
  SidebarStateType,
  sideBarStateType,
} from "../../../../types/layout-container-types";
import { SidebarItem } from "./sidebar-item";
import {
  HamBurgerSidebarItemsData,
  filterHamburgerMenuItemsWithPermissions,
} from "./utils";
import "./scrollbarStyle.css";
import useStore from "./useSidebar";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
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
} from "@phosphor-icons/react";
import type {
  SidebarItemsType,
  subItemsType,
} from "../../../../types/layout-container-types";
import { useStudentPermissions } from "@/hooks/use-student-permissions";
import { useIsIOS } from "@/hooks/useIsIOS";

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
        <span className="leading-none font-medium uppercase">{letter}</span>
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
  const { state, isMobile } = useSidebar();
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
    instructorPortalUrl,
    subOrgName,
    subOrgLogoUrl,
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

  const iconByTabId: Record<string, unknown> = useMemo(
    () => ({
      dashboard: House,
      "learning-center": BookOpen,
      homework: NotePencil,
      "assessment-center": Scroll,
    }),
    []
  );

  const defaultRouteByTabId: Record<string, string> = useMemo(
    () => ({
      dashboard: "/dashboard",
      referral: "/referral",
      attendance: "/learning-centre/attendance",
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
            .map((s) => ({
              subItem: s.label || s.id,
              subItemLink: s.route || "/",
            }))
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

  useEffect(() => {
    // Load display settings and compute sidebar items
    getStudentDisplaySettings(false).then((settings) => {
      const shouldHide = settings?.sidebar?.visible === false;
      setHideSidebar(!!shouldHide);
      const tabs = (settings?.sidebar?.tabs || []).slice();
      setFilteredSidebarItems(transformTabsToSidebarItems(tabs));
    });

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

  if (hideSidebar && !sidebarComponent) {
    return null;
  }

  return (
    <Sidebar side="left" collapsible={sidebarComponent ? "offcanvas" : "icon"}>
      <SidebarContent className={`sidebar-content flex flex-col bg-white dark:bg-neutral-900 py-1 transition-all duration-200 ${isIOS ? 'mt-10' : ''} ease-in-out max-w-full w-full overflow-x-hidden`}>
        <SidebarHeader>
          <SidebarMenu className="px-2">
            <SidebarMenuItem>
              <SidebarMenuButton
                size="default"
                className="h-auto min-h-10 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                onClick={
                  homeIconClickRoute ? handleInstituteLogoClick : undefined
                }
              >
                {subOrgName ? (
                  /* Sub-org branding: show sub-org logo/name + "Powered by parent" */
                  <div className="flex flex-col gap-1 py-1 w-full">
                    <div className="flex items-center gap-2">
                      <div className="flex aspect-square size-7 items-center justify-center rounded-md text-sidebar-primary-foreground shrink-0">
                        {subOrgLogoUrl ? (
                          <img src={subOrgLogoUrl} alt="Logo" className="size-7 object-contain rounded-md bg-white" />
                        ) : (
                          <div className="h-7 w-7 rounded-md bg-primary-50 dark:bg-neutral-800 flex items-center justify-center text-xs font-semibold text-primary-700 dark:text-neutral-200">
                            {(subOrgName[0] || "S").toUpperCase()}
                          </div>
                        )}
                      </div>
                      {isExpanded && (
                        <span className="truncate font-semibold uppercase text-sm leading-tight">
                          {subOrgName}
                        </span>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="flex items-center gap-1.5 pl-9">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Powered by</span>
                        {!isNullOrEmptyOrUndefined(instituteLogoFileUrl) ? (
                          <img src={instituteLogoFileUrl} alt={instituteName} className="h-4 w-auto max-w-[80px] object-contain" />
                        ) : (
                          <span className="text-[10px] font-semibold text-muted-foreground truncate">{instituteName}</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Default: parent institute branding */
                  <>
                    <div className="flex aspect-square size-7 items-center justify-center rounded-md text-sidebar-primary-foreground">
                      {!isNullOrEmptyOrUndefined(instituteLogoFileUrl) ? (
                        <img
                          src={instituteLogoFileUrl}
                          alt="Logo"
                          className="size-7 object-contain rounded-md bg-white"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-md bg-primary-50 dark:bg-neutral-800 flex items-center justify-center text-xs font-semibold text-primary-700 dark:text-neutral-200">
                          {(instituteName?.[0] || "I").toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold uppercase">
                        {instituteName}
                      </span>
                    </div>
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
        learnerPortalUrl) && (
          <SidebarFooter>
            {state === "expanded" || isMobile ? (
              <div className="flex flex-col gap-2 px-2 pb-2 mt-auto">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider pl-1">
                  Apps & Portals
                </span>
                <div className="flex flex-wrap gap-1">
                  {learnerPortalUrl && (
                    <a
                      href={learnerPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
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
                      className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
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
                      className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
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
                      className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
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
                      className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
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
                    <PopoverContent className="w-auto p-1 min-w-[3rem]" side="right" align="end">
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
            )}
          </SidebarFooter>
        )}
    </Sidebar>
  );
};
