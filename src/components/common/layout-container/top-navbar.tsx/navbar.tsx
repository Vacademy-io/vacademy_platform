// TODO: update the navbar when notifications and search api are avaoilable
// some function and varibale are commented for the same reason

import { SidebarTrigger } from "@/components/ui/sidebar";
// import { MagnifyingGlass, Bell, List } from "@phosphor-icons/react";
import { List } from "@phosphor-icons/react";
// import { Bell, List } from "@phosphor-icons/react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { FiSidebar } from "react-icons/fi";
// import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import useStore from "../sidebar/useSidebar";
import { Preferences } from "@capacitor/preferences";
import { getPublicUrl } from "@/services/upload_file";
import { LogoutSidebar } from "../sidebar/logoutSidebar";
import { getStudentDisplaySettings } from "@/services/student-display-settings";

export function Navbar() {
  // const [notifications, setNotifications] = useState<boolean>(true);
  // const navigate = useNavigate();
  const { navHeading } = useNavHeadingStore();
  const { setInstituteDetails, setSidebarOpen } = useStore();
  
  async function fetch() {
    try {
      const InstituteDetailsData = await Preferences.get({
        key: "InstituteDetails",
      });

      const InstituteDetails = InstituteDetailsData.value
        ? JSON.parse(InstituteDetailsData.value)
        : null;

      if (InstituteDetails) {
        const url = InstituteDetails.institute_logo_file_id
          ? await getPublicUrl(InstituteDetails.institute_logo_file_id)
          : "";

        setInstituteDetails(InstituteDetails.institute_name, url);
      }
    } catch (error) {
      console.error("Error fetching institute details:", error);
    }
  }

  const [showSidebarControls, setShowSidebarControls] = useState(true);

  useEffect(() => {
    // setNotifications(true);
    fetch();
    // Load sidebar visibility from Student Display Settings (uses cache on dashboard refresh)
    getStudentDisplaySettings(false)
      .then((s) => setShowSidebarControls(s?.sidebar?.visible !== false))
      .catch(() => setShowSidebarControls(true));
  }, []);
  
  // const navigateToNotificationsTab = () => {
  //   navigate({ to: "/dashboard/notifications" });
  // };

  return (
    <div className="sticky top-0 z-[9999] border-b border-primary-200/40 flex h-14 items-center justify-between bg-gradient-to-r from-white via-primary-50/20 to-blue-50/20 px-4 md:px-5 py-2 transition-all duration-300 shadow-sm">
      <LogoutSidebar />
      
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {showSidebarControls && (
          <SidebarTrigger>
            <div 
              onClick={() => {}}
              className="group flex items-center justify-center w-8 h-8 rounded-md border border-primary-200/50 bg-gradient-to-br from-white to-primary-50/40 hover:from-primary-50 hover:to-primary-100 hover:border-primary-300 transition-all duration-200"
            >
              <FiSidebar className="w-4 h-4 text-primary-600 group-hover:text-primary-700 transition-colors duration-200" />
            </div>
          </SidebarTrigger>
        )}
        
        <div className="flex items-center gap-3">
          <div className="w-px h-6 bg-gradient-to-b from-transparent via-primary-300/60 to-transparent"></div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-primary-500 via-primary-600 to-blue-600 rounded-full shadow-sm"></div>
            <div className="relative">
              <h1 className="text-base font-semibold text-neutral-900 leading-tight">
                {navHeading}
              </h1>
              <div className="absolute -bottom-0.5 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-300/50 to-transparent"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Search Icon - Commented for future use */}
        {/* <button className="group flex items-center justify-center w-9 h-9 rounded-lg border border-primary-200/50 bg-gradient-to-br from-white to-primary-50/50 hover:from-primary-50 hover:to-primary-100 hover:border-primary-300 transition-all duration-300 hover:scale-105 hover:shadow-md shadow-sm">
          <MagnifyingGlass className="w-4 h-4 text-primary-600 group-hover:text-primary-700 transition-colors duration-200" />
        </button> */}

        {/* Notifications - Commented for future use */}
        {/* <button 
          className="group relative flex items-center justify-center w-9 h-9 rounded-lg border border-primary-200/50 bg-gradient-to-br from-white to-primary-50/50 hover:from-primary-50 hover:to-primary-100 hover:border-primary-300 transition-all duration-300 hover:scale-105 hover:shadow-md shadow-sm"
          onClick={navigateToNotificationsTab}
        >
          <Bell className="w-4 h-4 text-primary-600 group-hover:text-primary-700 transition-colors duration-200" />
          {notifications && (
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-red-400 to-red-500 border-2 border-white shadow-lg animate-pulse ring-2 ring-red-300/30"></div>
          )}
        </button> */}

        <div className="w-px h-6 bg-gradient-to-b from-transparent via-primary-300/60 to-transparent"></div>
        
        {/* Menu Button (always visible) */}
        <button
          className="group relative flex items-center justify-center w-9 h-9 rounded-md border border-primary-200/50 bg-gradient-to-br from-white to-primary-50/40 hover:from-primary-100 hover:to-primary-200 hover:border-primary-400 transition-all duration-200 overflow-hidden"
          onClick={() => {
            setSidebarOpen();
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-400/0 to-primary-600/0 group-hover:from-primary-400/10 group-hover:to-primary-600/20 transition-all duration-300"></div>
          <List className="relative w-4 h-4 text-primary-600 group-hover:text-primary-700 transition-colors duration-200" />
          <div className="absolute inset-0 rounded-md bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </button>
      </div>
    </div>
  );
}
