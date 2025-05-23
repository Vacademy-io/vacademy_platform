import { create } from "zustand";
import { sideBarStateType } from "../../../../types/layout-container-types";
import { Preferences } from "@capacitor/preferences";
import { getPublicUrl } from "@/services/upload_file";

interface StoreState {
  sideBarState: sideBarStateType;
  sideBarOpen:boolean;
  instituteName: string;
  instituteLogoFileUrl: string;
  setSidebarOpen:()=>void;
  setSideBarState: (sidebarstate: sideBarStateType) => void;
  setInstituteDetails: (instituteName : string, instituteLogoFileUrl : string) => void;
}

const useStore = create<StoreState>((set) => ({
  sideBarState: sideBarStateType.DEFAULT,
  sideBarOpen: false,
  instituteName: "",
  instituteLogoFileUrl: "",
  setSidebarOpen: () => set((state) => ({ sideBarOpen: !state.sideBarOpen })),
  setSideBarState: (sidebarstate) => set({ sideBarState: sidebarstate }),

  setInstituteDetails: async () => {
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
