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
  // Sub-org branding (from student_sub_org junction)
  subOrgName: string | null;
  subOrgLogoUrl: string | null;
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
  subOrgName: null,
  subOrgLogoUrl: null,
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

        // Also resolve sub-org branding from stored authenticated details
        try {
          const stored = await Preferences.get({ key: "InstituteDetails" });
          if (stored.value) {
            const details = JSON.parse(stored.value);
            const subOrgs = details?.sub_orgs;
            if (Array.isArray(subOrgs) && subOrgs.length > 0) {
              const activeSubOrg = subOrgs.find((s: any) => s.status === "ACTIVE") || subOrgs[0];
              const subOrgLogoUrl = activeSubOrg.logo_file_id
                ? await getPublicUrl(activeSubOrg.logo_file_id)
                : null;
              set({
                subOrgName: activeSubOrg.name || null,
                subOrgLogoUrl,
              });
            }
          }
        } catch {
          // Sub-org resolution is best-effort
        }
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

        // Resolve sub-org branding if learner belongs to one
        const subOrgs = InstituteDetails.sub_orgs;
        let subOrgName: string | null = null;
        let subOrgLogoUrl: string | null = null;
        if (Array.isArray(subOrgs) && subOrgs.length > 0) {
          const activeSubOrg = subOrgs.find((s: any) => s.status === "ACTIVE") || subOrgs[0];
          subOrgName = activeSubOrg.name || null;
          if (activeSubOrg.logo_file_id) {
            subOrgLogoUrl = await getPublicUrl(activeSubOrg.logo_file_id);
          }
        }

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
          subOrgName,
          subOrgLogoUrl,
        });
      }
    } catch (error) {
      console.error("Error fetching institute details:", error);
    }
  },
}));

export default useStore;
