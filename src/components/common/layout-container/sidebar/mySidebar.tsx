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
import { SidebarItemsData, HamBurgerSidebarItemsData, filterMenuItems } from "./utils";
import "./scrollbarStyle.css";
import useStore from "./useSidebar";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { useEffect, useState } from "react";

export const MySidebar = ({
    sidebarComponent,
}: {
    sidebarComponent?: React.ReactNode;
}) => {
    const { state }: SidebarStateType = useSidebar();
    const { sideBarState, instituteName, instituteLogoFileUrl } = useStore();

    const [filteredSidebarItems, setFilteredSidebarItems] =
        useState(SidebarItemsData);

    useEffect(() => {
        if (sideBarState === sideBarStateType.DEFAULT) {
            filterMenuItems(SidebarItemsData).then((data) => {
                console.log(data);
                setFilteredSidebarItems(data);
            });
        }
    }, [sideBarState]);

    const isExpanded = state === "expanded";

    return (
        <Sidebar side="left" collapsible="icon">
            <SidebarContent className="sidebar-content flex flex-col bg-white border-r border-gray-200 py-4 transition-all duration-300 ease-in-out">
                <SidebarHeader
                    className={`flex items-center px-3 pb-4 mb-4 border-b border-gray-100 transition-all duration-300 ${
                        isExpanded
                            ? "flex-row gap-2 justify-start"
                            : "flex-col gap-1 justify-center"
                    }`}
                >
                    <div className="relative">
                        {!isNullOrEmptyOrUndefined(instituteLogoFileUrl) ? (
                            <img
                                className={`object-cover shadow-sm border border-gray-200 transition-all duration-300 ${
                                    isExpanded
                                        ? "w-8 h-8 rounded-md"
                                        : "w-7 h-7 rounded-md"
                                }`}
                                src={instituteLogoFileUrl}
                                alt="Logo"
                            />
                        ) : (
                            <div
                                className={`bg-primary-50 border border-primary-200 rounded-md flex items-center justify-center transition-all duration-300 ${
                                    isExpanded ? "w-8 h-8" : "w-7 h-7"
                                }`}
                            >
                                <div
                                    className={`bg-primary-500 rounded-sm ${isExpanded ? "w-4 h-4" : "w-3 h-3"}`}
                                ></div>
                            </div>
                        )}
                    </div>

                    {isExpanded && (
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                                {instituteName}
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                                Dashboard
                            </p>
                        </div>
                    )}
                </SidebarHeader>

                <SidebarMenu
                    className={`flex flex-col px-2 space-y-1 flex-1 transition-all duration-300 ${
                        isExpanded ? "items-stretch" : "items-center"
                    }`}
                >
                    {sidebarComponent
                        ? sidebarComponent
                        : (() => {
                              const items =
                                  sideBarState === sideBarStateType.HAMBURGER
                                      ? HamBurgerSidebarItemsData
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
                                          subItems={obj.subItems}
                                          title={obj.title}
                                          to={obj.to}
                                      />
                                  </SidebarMenuItem>
                              ));
                          })()}
                </SidebarMenu>
            </SidebarContent>
        </Sidebar>
    );
};
