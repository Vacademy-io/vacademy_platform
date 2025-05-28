import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
} from "@/components/ui/sheet";

import { SidebarItem } from "./sidebar-item";
import { HamBurgerSidebarItemsData } from "./utils";
import "./scrollbarStyle.css";
import useStore from "./useSidebar";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";

export const LogoutSidebar = ({
  sidebarComponent,
}: {
  sidebarComponent?: React.ReactNode;
}) => {
  const { instituteName, instituteLogoFileUrl , sideBarOpen , setSidebarOpen } = useStore();
  return (
    <Sheet open={sideBarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent
        side="right"
        className={`sidebar-content flex flex-col gap-5 border-r-2 border-r-neutral-300 bg-sidebar-primary-foreground py-10`}
      >
        <SheetHeader className="">
          <div className={`flex items-center justify-center gap-4`}>
            <div className="size-14">
              {!isNullOrEmptyOrUndefined(instituteLogoFileUrl) ? (
                 <img
                 className="size-14 rounded-full"
                 src={instituteLogoFileUrl}
                 alt="Logo"
               />
              ) : (
                <div className="size-12 border border-primary-500 rounded-full"></div>
              )}
            </div>
            <SheetDescription className="text-[18px] font-semibold text-primary-500 group-data-[collapsible=icon]:hidden">
              {instituteName}
            </SheetDescription>
          </div>
        </SheetHeader>
        <SheetDescription
          className={`flex  flex-col justify-center gap-6 py-4`}
        >
          {sidebarComponent
            ? sidebarComponent
            : HamBurgerSidebarItemsData.map((obj, key) => (
                <div key={key}>
                  <SidebarItem
                    icon={obj.icon}
                    subItems={obj.subItems}
                    title={obj.title}
                    to={obj.to}
                  />
                </div>
              ))}
        </SheetDescription>
      </SheetContent>
    </Sheet>
  );
};
