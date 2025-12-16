import { SidebarItemsType } from "../../../../types/layout-container-types";
import {
  House,
  BookOpen,
  Scroll,
  SignOut,
  NotePencil,
  Users,
} from "@phosphor-icons/react";
import { Files, Password, UserCircle, UserCircleMinus } from "@phosphor-icons/react";
import { NamingSettingsType } from "@/services/fetchAndStoreInstituteDetails";
import { NAMING_SETTINGS_KEY } from "@/types/naming-settings";

const getNamingSettings = (): NamingSettingsType[] => {
  try {
    const saved = localStorage.getItem(NAMING_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Failed to parse naming settings from localStorage:", error);
    return [];
  }
};

// Utility function to get custom terminology with fallback to default
export const getTerminology = (key: string, defaultValue: string): string => {
  const settings = getNamingSettings();
  const setting = settings.find((item) => item.key === key);
  return setting?.customValue || defaultValue;
};

export const SidebarItemsData: SidebarItemsType[] = [
  {
    icon: House,
    title: "Dashboard",
    to: "/dashboard",
  },
  {
    icon: BookOpen,
    title: "Learning Center",
    subItems: [
      {
        subItem: "Study Library",
        subItemLink: "/study-library",
      },
      {
        subItem: "Attendance",
        subItemLink: "/learning-centre/attendance",
      },
      {
        subItem: "Live Class",
        subItemLink: "/study-library/live-class",
      },
    ],
  },
  {
    icon: NotePencil,
    title: "Homework",
    subItems: [
      {
        subItem: "Homework List",
        subItemLink: "/homework/list",
      },
      {
        subItem: "Reports",
        subItemLink: "/homework/reports",
      },
    ],
  },
  {
    icon: Users,
    title: "Sub-Org Learners",
    to: "/sub-org-learners",
  },
  {
    icon: Scroll,
    title: "Assessment Centre",
    subItems: [
      {
        subItem: "Assessment List",
        subItemLink: "/assessment/examination",
      },
      // {
      //     subItem: "Mock Test",
      //     subItemLink: "/assessment/mock-test",
      // },
      // {
      //     subItem: "Practice Test",
      //     subItemLink: "/assessment/practice-test",
      // },
      // {
      //     subItem: "Survey",
      //     subItemLink: "/assessment/survey",
      // },
      {
        subItem: "Reports",
        subItemLink: "/assessment/reports",
      },
    ],
  },
];
export const HamBurgerSidebarItemsData: SidebarItemsType[] = [
  //TODO : add other options when api and ui is available
  {
    icon: UserCircle,
    title: "View Profile Details",
    to: "/user-profile",
  },
  {
    icon: Files,
    title: "My Files",
    to: "/my-files",
  },
  // {
  //   icon: CreditCard,
  //   title: "Membership Details",
  //   to: "/membership-details",
  // },
  {
    icon: Password,
    title: "Change Password",
    to: "/change-password",
  },
  // {
  //   icon: Headset,
  //   title: "Contact Support",
  //   to: "/support",
  // },
  {
    icon: SignOut,
    title: "Log Out",
    to: "/logout",
  },
  {
    icon: UserCircleMinus,
    title: "Delete Account",
    to: "/delete-user",
  },
];

// New function to filter menu items based on permissions
export async function filterHamburgerMenuItemsWithPermissions(
  HamBurgerSidebarItemsData: SidebarItemsType[],
  permissions: {
    canViewProfile: boolean;
    canEditProfile: boolean;
    canDeleteProfile: boolean;
    canViewFiles: boolean;
  }
) {
  // Filter based on permissions
  if (!permissions.canViewProfile) {
    HamBurgerSidebarItemsData = HamBurgerSidebarItemsData.filter(
      (item) => item.title !== "View Profile Details"
    );
  }
  
  if (!permissions.canViewFiles) {
    HamBurgerSidebarItemsData = HamBurgerSidebarItemsData.filter(
      (item) => item.title !== "My Files"
    );
  }

  if (!permissions.canEditProfile) {
    HamBurgerSidebarItemsData = HamBurgerSidebarItemsData.filter(
      (item) => item.title !== "Change Password"
    );
  }

  if (!permissions.canDeleteProfile) {
    HamBurgerSidebarItemsData = HamBurgerSidebarItemsData.filter(
      (item) => item.title !== "Delete Account"
    );
  }

  return HamBurgerSidebarItemsData;
}
