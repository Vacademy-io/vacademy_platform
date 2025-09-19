import React, { useEffect, useMemo, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
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
import { House, BookOpen, NotePencil, Scroll } from "@phosphor-icons/react";
import type {
  SidebarItemsType,
  subItemsType,
} from "../../../../types/layout-container-types";
import { useStudentPermissions } from "@/hooks/use-student-permissions";

export const MySidebar = ({
  sidebarComponent,
}: {
  sidebarComponent?: React.ReactNode;
}) => {
  const navigate = useNavigate();
  const { state }: SidebarStateType = useSidebar();
  const { sideBarState, instituteName, instituteLogoFileUrl } = useStore();
  const { permissions } = useStudentPermissions();
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
        return {
          icon: iconByTabId[t.id] || House,
          title: t.label || labelByTabId[t.id] || t.id,
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
    <Sidebar side="left" collapsible="icon">
      <SidebarContent className="sidebar-content flex flex-col bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 py-2 transition-all duration-200 ease-in-out">
        <SidebarHeader
          className={`flex items-center px-3 pb-2 mb-2 border-b border-gray-100 dark:border-neutral-800 transition-all duration-200 ${
            isExpanded
              ? "flex-row gap-2 justify-start"
              : "flex-col gap-1 justify-center"
          }`}
        >
          <div className="relative">
            {!isNullOrEmptyOrUndefined(instituteLogoFileUrl) ? (
              <img
                className={`object-contain shadow-sm border border-gray-200 transition-all duration-200 ${
                  isExpanded ? "w-16 h-10 rounded-md" : "w-12 h-8 rounded-md"
                }`}
                src={instituteLogoFileUrl}
                alt="Logo"
              />
            ) : (
              <div
                className={`bg-primary-50 border border-primary-200 rounded-md flex items-center justify-center transition-all duration-200 ${
                  isExpanded ? "w-16 h-10" : "w-12 h-8"
                }`}
              >
                <div
                  className={`bg-primary-500 rounded-sm ${
                    isExpanded ? "w-8 h-4" : "w-6 h-3"
                  }`}
                ></div>
              </div>
            )}
          </div>

          {isExpanded && (
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => navigate({ to: "/dashboard" })}
            >
              <div className="text-sm font-semibold text-gray-900 dark:text-neutral-100 truncate">
                {instituteName}
              </div>
            </div>
          )}
        </SidebarHeader>

        <SidebarMenu
          className={`flex flex-col space-y-1 flex-1 transition-all duration-200 ${
            isExpanded ? "items-stretch" : "items-center"
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
                  <SidebarMenuItem
                    key={key}
                    className="animate-slide-in-left"
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
                  </SidebarMenuItem>
                ));
              })()}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
};
