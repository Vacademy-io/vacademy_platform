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

import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { useUpdate } from "@/stores/useUpdate";
import Favicon from "react-favicon";
import useStore from "@/components/common/layout-container/sidebar/useSidebar";
import { Preferences } from "@capacitor/preferences";
import { useTheme } from "@/providers/theme/theme-provider";
import { HOLISTIC_INSTITUTE_ID } from "@/constants/urls";
import { useInstituteFeatureStore } from "@/stores/insititute-feature-store";

const RootComponent = () => {
  const { setUpdateAvailable } = useUpdate();
  const { instituteLogoFileUrl } = useStore();
  const vacademyUrl = "/vacademy-logo.svg";
  const { setPrimaryColor } = useTheme();
  const { setInstituteId } = useInstituteFeatureStore();

  const setPrimaryColorFromStorage = async () => {
    const details = await Preferences.get({ key: "InstituteDetails" });
    const parsedDetails = details.value ? JSON.parse(details.value) : null;
    const themeCode = parsedDetails?.institute_theme_code;
    const instituteId = parsedDetails?.id;
    setInstituteId(instituteId);
    if (instituteId === HOLISTIC_INSTITUTE_ID) {
      setPrimaryColor("holistic");
    } else {
      setPrimaryColor(themeCode ?? "primary");
    }
  };

  const getFallbackLogoUrl = (logoUrl: string | null | undefined): string => {
    return logoUrl && logoUrl.trim() !== "" ? logoUrl : vacademyUrl;
  };

  useEffect(() => {
    const checkForUpdate = async () => {
      if (Capacitor.getPlatform() === "web") return;

      try {
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
      } catch (error) {
        console.error("Error checking app update:", error);
      }
    };

    checkForUpdate();
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
