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
        className="sidebar-content flex flex-col bg-white border-l border-gray-200 p-0 w-72 transition-all duration-300 ease-in-out"
      >
        <SheetHeader className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="relative">
              {!isNullOrEmptyOrUndefined(instituteLogoFileUrl) ? (
                <img
                  className="w-8 h-8 rounded-md object-cover shadow-sm border border-gray-200"
                  src={instituteLogoFileUrl}
                  alt="Logo"
                />
              ) : (
                <div className="w-8 h-8 bg-primary-50 border border-primary-200 rounded-md flex items-center justify-center">
                  <div className="w-4 h-4 bg-primary-500 rounded-sm"></div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <SheetDescription className="text-sm font-semibold text-gray-900 truncate">
                {instituteName}
              </SheetDescription>
              <p className="text-xs text-gray-500">Menu</p>
            </div>
          </div>
        </SheetHeader>
        
        <div className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {sidebarComponent
            ? sidebarComponent
            : HamBurgerSidebarItemsData.map((obj, key) => (
                <div 
                  key={key}
                  className="animate-slide-in-right"
                  style={{ animationDelay: `${key * 30}ms` }}
                >
                  <SidebarItem
                    icon={obj.icon}
                    subItems={obj.subItems}
                    title={obj.title}
                    to={obj.to}
                  />
                </div>
              ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
