import { create } from "zustand";
import { sideBarStateType } from "../../../../types/layout-container-types";
import { Preferences } from "@capacitor/preferences";
import { getPublicUrl } from "@/services/upload_file";

interface StoreState {
  sideBarState: sideBarStateType;
  sideBarOpen: boolean;
  instituteName: string;
  instituteLogoFileUrl: string;
  homeIconClickRoute: string | null;
  playStoreAppLink: string | null;
  appStoreAppLink: string | null;
  windowsAppLink: string | null;
  macAppLink: string | null;
  learnerPortalUrl: string | null;
  instructorPortalUrl: string | null;
  hasCustomSidebar: boolean;
  setSidebarOpen: () => void;
  setSideBarState: (sidebarstate: sideBarStateType) => void;
  setInstituteDetails: (
    instituteName?: string,
    instituteLogoFileUrl?: string,
    homeIconClickRoute?: string | null
  ) => void;
  setHasCustomSidebar: (value: boolean) => void;
}

const useStore = create<StoreState>((set) => ({
  sideBarState: sideBarStateType.DEFAULT,
  sideBarOpen: false,
  instituteName: "",
  instituteLogoFileUrl: "",
  homeIconClickRoute: null,
  playStoreAppLink: null,
  appStoreAppLink: null,
  windowsAppLink: null,
  macAppLink: null,
  learnerPortalUrl: null,
  instructorPortalUrl: null,
  hasCustomSidebar: false,
  setSidebarOpen: () => set((state) => ({ sideBarOpen: !state.sideBarOpen })),
  setSideBarState: (sidebarstate) => set({ sideBarState: sidebarstate }),
  setHasCustomSidebar: (value: boolean) => set({ hasCustomSidebar: value }),

  setInstituteDetails: async (
    name?: string,
    logoUrl?: string,
    homeIconClickRoute?: string | null
  ) => {
    try {
      // If explicit values are provided, set them directly
      if (typeof name === 'string') {
        set({
          instituteName: name,
          instituteLogoFileUrl: logoUrl ?? "",
          homeIconClickRoute: homeIconClickRoute ?? null,
        });
        return;
      }

      // Fallback: fetch from Preferences
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

        set({
          instituteName: InstituteDetails.institute_name,
          instituteLogoFileUrl: url,
          homeIconClickRoute:
            InstituteDetails.home_icon_click_route ??
            InstituteDetails.homeIconClickRoute ??
            null,
          playStoreAppLink: InstituteDetails.playStoreAppLink ?? null,
          appStoreAppLink: InstituteDetails.appStoreAppLink ?? null,
          windowsAppLink: InstituteDetails.windowsAppLink ?? null,
          macAppLink: InstituteDetails.macAppLink ?? null,
          learnerPortalUrl: InstituteDetails.learnerPortalUrl ?? null,
          instructorPortalUrl: InstituteDetails.instructorPortalUrl ?? null,
        });
      }
    } catch (error) {
      console.error("Error fetching institute details:", error);
    }
  },
}));

export default useStore;
