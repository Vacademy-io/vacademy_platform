import { SidebarItemsType } from "../../../../types/layout-container-types";
import {
  House,
  BookOpen,
  Scroll,
  SignOut,
  NotePencil,
  Users,
} from "@phosphor-icons/react";
import {
  AddressBook,
  Files,
  Password,
  UserCircle,
  UserCircleMinus,
} from "phosphor-react";
import { NamingSettingsType } from "@/services/fetchAndStoreInstituteDetails";
import {
  ContentTerms,
  NAMING_SETTINGS_KEY,
  SystemTerms,
} from "@/types/naming-settings";

const getNamingSettings = (): NamingSettingsType[] => {
  try {
    const saved = localStorage.getItem(NAMING_SETTINGS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
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

// Utility function to get pluralized terminology.
// Handles two storage formats:
//  1. Raw backend format (learner): separate { key: "X_plural", customValue } entry
//  2. Admin merged format: single entry with customPluralValue field
// Falls back to naive pluralization of the singular custom value / default.
export const getTerminologyPlural = (
  key: string,
  defaultValue: string
): string => {
  const settings = getNamingSettings();

  // Format 1: explicit _plural entry from backend
  const pluralEntry = settings.find((item) => item.key === `${key}_plural`);
  if (pluralEntry?.customValue) {
    return pluralEntry.customValue;
  }

  const setting = settings.find((item) => item.key === key);

  // Format 2: merged entry with customPluralValue field
  if (setting?.customPluralValue) {
    return setting.customPluralValue;
  }

  // Fallback: naive pluralize the singular value
  const singular = setting?.customValue || defaultValue;
  return naivePluralize(singular);
};

const naivePluralize = (word: string): string => {
  if (
    word.endsWith("s") ||
    word.endsWith("x") ||
    word.endsWith("z") ||
    word.endsWith("ch") ||
    word.endsWith("sh")
  ) {
    return `${word}es`;
  }
  if (
    word.endsWith("y") &&
    !["a", "e", "i", "o", "u"].includes(
      word.charAt(word.length - 2).toLowerCase()
    )
  ) {
    return `${word.slice(0, -1)}ies`;
  }
  return `${word}s`;
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
        subItem: getTerminologyPlural(
          ContentTerms.LiveSession,
          SystemTerms.LiveSession
        ),
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
  { icon: AddressBook, title: "My Reports", to: "/my-reports" },
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
    canViewReports: boolean;
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

  if (!permissions.canViewReports) {
    HamBurgerSidebarItemsData = HamBurgerSidebarItemsData.filter(
      (item) => item.title !== "My Reports"
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
