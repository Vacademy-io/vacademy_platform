import { create } from "zustand";
import { sideBarStateType } from "../../../../types/layout-container-types";
import { Preferences } from "@capacitor/preferences";
import { getPublicUrl } from "@/services/upload_file";

interface StoreState {
  sideBarState: sideBarStateType;
  sideBarOpen: boolean;
  instituteName: string;
  instituteLogoFileUrl: string;
  hasCustomSidebar: boolean;
  setSidebarOpen: () => void;
  setSideBarState: (sidebarstate: sideBarStateType) => void;
  setInstituteDetails: (
    instituteName?: string,
    instituteLogoFileUrl?: string
  ) => void;
  setHasCustomSidebar: (value: boolean) => void;
}

const useStore = create<StoreState>((set) => ({
  sideBarState: sideBarStateType.DEFAULT,
  sideBarOpen: false,
  instituteName: "",
  instituteLogoFileUrl: "",
  hasCustomSidebar: false,
  setSidebarOpen: () => set((state) => ({ sideBarOpen: !state.sideBarOpen })),
  setSideBarState: (sidebarstate) => set({ sideBarState: sidebarstate }),
  setHasCustomSidebar: (value: boolean) => set({ hasCustomSidebar: value }),

  setInstituteDetails: async (name?: string, logoUrl?: string) => {
    try {
      // If explicit values are provided, set them directly
      if (typeof name === 'string') {
        set({
          instituteName: name,
          instituteLogoFileUrl: logoUrl ?? "",
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
        });
      }
    } catch (error) {
      console.error("Error fetching institute details:", error);
    }
  },
}));

export default useStore;
