import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { useEffect } from "react";
import {
  AppUpdate,
  AppUpdateAvailability,
} from "@capawesome/capacitor-app-update";

import { toast } from "sonner";
import { useUpdate } from "@/stores/useUpdate";
import Favicon from "react-favicon";
import useStore from "@/components/common/layout-container/sidebar/useSidebar";
import { Preferences } from "@capacitor/preferences";
import { useTheme } from "@/providers/theme/theme-provider";

const RootComponent = () => {
  const { setUpdateAvailable } = useUpdate();
  const { instituteLogoFileUrl } = useStore();
  const vacademyUrl = "/vacademy-logo.svg";
  const { setPrimaryColor } = useTheme();

  const setPrimaryColorFromStorage = async () => {
    const details = await Preferences.get({ key: "InstituteDetails" });
    const parsedDetails = details.value ? JSON.parse(details.value) : null;
    const themeCode = parsedDetails?.institute_theme_code;
    if (themeCode) {
      setPrimaryColor(themeCode);
    }
  };

  const getFallbackLogoUrl = (logoUrl: string | null | undefined): string => {
    return logoUrl && logoUrl.trim() !== "" ? logoUrl : vacademyUrl;
  };

  useEffect(() => {
    (async () => {
      const result = await AppUpdate.getAppUpdateInfo();
      if (
        result.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE
      ) {
        toast.warning("Update available, please update app...");
        setUpdateAvailable(true);
        if (result.immediateUpdateAllowed) {
          await AppUpdate.performImmediateUpdate();
        }
      }
    })();
    setPrimaryColorFromStorage();
  }, []);

  return (
    <>
      <Outlet />
      <Favicon url={getFallbackLogoUrl(instituteLogoFileUrl)} />
    </>
  );
};

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/") {
      throw redirect({
        to: "/login",
      });
    }
  },
  component: RootComponent,
});
