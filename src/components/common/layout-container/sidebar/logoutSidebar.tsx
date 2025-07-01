import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
} from "@/components/ui/sheet";
import { SidebarMenu } from "@/components/ui/sidebar";

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
  const { instituteName, instituteLogoFileUrl, sideBarOpen, setSidebarOpen } = useStore();
  
  return (
    <Sheet open={sideBarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent
        side="right"
        className="sidebar-content flex flex-col bg-white border-l border-neutral-200 p-0 w-80 transition-all duration-300 ease-in-out z-[9999] shadow-xl"
      >
        <SheetHeader className="px-5 py-5 border-b border-neutral-100 bg-gradient-to-r from-white to-neutral-50">
          <div className="flex items-center gap-3">
            <div className="relative group">
              {!isNullOrEmptyOrUndefined(instituteLogoFileUrl) ? (
                <div className="relative">
                  <img
                    className="w-10 h-10 rounded-lg object-cover border border-neutral-200 transition-all duration-300 group-hover:scale-105 group-hover:shadow-md"
                    src={instituteLogoFileUrl}
                    alt="Institute Logo"
                  />
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-md">
                  <div className="w-5 h-5 bg-gradient-to-br from-primary-500 to-primary-600 rounded shadow-sm"></div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <SheetDescription className="text-base font-bold text-neutral-900 truncate leading-tight">
                {instituteName}
              </SheetDescription>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mt-0.5">
                Navigation Menu
              </p>
            </div>
          </div>
        </SheetHeader>
        
        <div className="flex-1 px-3 py-4 overflow-y-auto bg-gradient-to-b from-white to-neutral-50/50">
          <SidebarMenu className="space-y-1.5">
            {sidebarComponent
              ? sidebarComponent
              : HamBurgerSidebarItemsData.map((obj, key) => (
                  <div 
                    key={key}
                    className="animate-slide-in-right transform transition-all duration-300 hover:scale-[1.01]"
                    style={{ 
                      animationDelay: `${key * 40}ms`,
                      animationFillMode: 'both'
                    }}
                  >
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-primary-600/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-95 group-hover:scale-100"></div>
                      <SidebarItem
                        icon={obj.icon}
                        subItems={obj.subItems}
                        title={obj.title}
                        to={obj.to}
                      />
                    </div>
                  </div>
                ))}
          </SidebarMenu>
        </div>

        <div className="px-4 py-3 border-t border-neutral-100 bg-gradient-to-r from-neutral-50 to-white">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              <span className="font-medium">Connected</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
