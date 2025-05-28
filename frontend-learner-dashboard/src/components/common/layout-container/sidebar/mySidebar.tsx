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
import { SidebarItemsData, HamBurgerSidebarItemsData } from "./utils";
import "./scrollbarStyle.css";
import useStore from "./useSidebar";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";

export const MySidebar = ({
  sidebarComponent,
}: {
  sidebarComponent?: React.ReactNode;
}) => {
  const { state }: SidebarStateType = useSidebar();
  const { sideBarState, instituteName, instituteLogoFileUrl } =
    useStore();
  return (
    <Sidebar side="left" collapsible="icon">
      <SidebarContent
        className={`sidebar-content flex flex-col gap-5 border-r-2 border-r-neutral-300 ${sideBarState === sideBarStateType.DEFAULT ? " bg-primary-50 " : " bg-sidebar-primary-foreground "}  py-10 ${
          state == "expanded" ? "w-[307px]" : "w-28"
        }`}
      >
        <SidebarHeader className={`flex items-center flex-row gap-4  ${
              state == "expanded" ? "pl-4 justify-start" : "pl-0 justify-center"
            }`}>
            <div className="size-14">
              {!isNullOrEmptyOrUndefined(instituteLogoFileUrl) ? (
                <img
                  className="size-14 rounded-full"
                  src={instituteLogoFileUrl}
                  alt="Logo"
                />
              ) : (
                <div className="size-20 border border-primary-500 rounded-full"></div>
              )}
            </div>
            <div className="text-[18px] font-semibold text-primary-500 group-data-[collapsible=icon]:hidden">
              {instituteName}
            </div>
        </SidebarHeader>
        <SidebarMenu
          className={`flex  flex-col justify-center gap-6 py-4 ${
            state == "expanded" ? "items-stretch" : "items-center"
          }`}
        >
          {sidebarComponent
            ? sidebarComponent
            : (() => {
                switch (sideBarState) {
                  case sideBarStateType.DEFAULT:
                    return SidebarItemsData.map((obj, key) => (
                      <SidebarMenuItem key={key}>
                        <SidebarItem
                          icon={obj.icon}
                          subItems={obj.subItems}
                          title={obj.title}
                          to={obj.to}
                        />
                      </SidebarMenuItem>
                    ));
                  case sideBarStateType.HAMBURGER:
                    return HamBurgerSidebarItemsData.map((obj, key) => (
                      <SidebarMenuItem key={key}>
                        <SidebarItem
                          icon={obj.icon}
                          subItems={obj.subItems}
                          title={obj.title}
                          to={obj.to}
                        />
                      </SidebarMenuItem>
                    ));
                  default:
                    return SidebarItemsData.map((obj, key) => (
                      <SidebarMenuItem key={key}>
                        <SidebarItem
                          icon={obj.icon}
                          subItems={obj.subItems}
                          title={obj.title}
                          to={obj.to}
                        />
                      </SidebarMenuItem>
                    ));
                }
              })()}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
};
