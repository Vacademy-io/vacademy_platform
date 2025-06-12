// TODO: update the navbar when notifications and search api are avaoilable
// some function and varibale are commented for the same reason

import { SidebarTrigger } from "@/components/ui/sidebar";
// import { MagnifyingGlass, Bell, List } from "@phosphor-icons/react";
import { List } from "@phosphor-icons/react";
// import { Bell, List } from "@phosphor-icons/react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { FiSidebar } from "react-icons/fi";
// import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import useStore from "../sidebar/useSidebar";
import { Preferences } from "@capacitor/preferences";
import { getPublicUrl } from "@/services/upload_file";
import {LogoutSidebar} from "../sidebar/logoutSidebar"

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

  useEffect(() => {
    // setNotifications(true);
    fetch();
  }, []);
  // const navigateToNotificationsTab = () => {
  //   navigate({ to: "/dashboard/notifications" });
  // };

  return (
    <div className="flex h-[72px] items-center justify-between bg-neutral-50 max-sm:px-2 px-8 py-4">
      <LogoutSidebar/>
      <div className="flex items-center gap-3">
        <SidebarTrigger>
          <div
            onClick={() => {
            }}
          >
            <FiSidebar className="text-neutral-600" />
          </div>
        </SidebarTrigger>
        <div className="border-l border-neutral-500 px-3 sm max-sm:text-h3 text-subtitle font-body text-neutral-600">
          {navHeading}
        </div>
      </div>
      <div className="flex gap-3 text-neutral-600">
        {/* <MagnifyingGlass className="size-5" /> */}
        {/* <div className="relative" onClick={navigateToNotificationsTab}>
          <Bell className="size-5" />
          {notifications && (
            <div className="absolute right-0 top-0 size-2 rounded-full bg-primary-500"></div>
          )}
        </div> */}
        <div
          className="size-5 cursor-pointer"
          onClick={() => {
            setSidebarOpen();
          }}
        >
          <List className="size-5" />
        </div>
      </div>
    </div>
  );
}
