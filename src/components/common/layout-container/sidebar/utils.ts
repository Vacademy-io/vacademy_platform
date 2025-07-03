import { getInstituteId } from "@/constants/helper";
import { SidebarItemsType } from "../../../../types/layout-container-types";
import {
    House,
    BookOpen,
    Scroll,
    SignOut,
    NotePencil,
} from "@phosphor-icons/react";
import {
  CreditCard,
  Headset,
  MonitorPlay,
  Password,
  UserCircle,
  UserCircleMinus,
  UsersThree,
} from "phosphor-react";
import {
  CODE_CIRCLE_INSTITUTE_ID,
  HOLISTIC_INSTITUTE_ID,
} from "@/constants/urls";

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
    icon: CreditCard,
    title: "Membership Details",
    to: "/membership-details",
  },
  {
    icon: Password,
    title: "Change Password",
    to: "/change-password",
  },
  {
    icon: Headset,
    title: "Contact Support",
    to: "/support",
  },
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

export async function filterMenuItems(SidebarItemsData: SidebarItemsType[]) {
  const instituteId = await getInstituteId();
  if (instituteId === CODE_CIRCLE_INSTITUTE_ID) {
    return SidebarItemsData.filter(
      (item) => item.title !== "Homework" && item.title !== "Assessment Centre"
    );
  } else if (instituteId === HOLISTIC_INSTITUTE_ID) {
    // Return only 3 specific items for holistic
    return [
      {
        icon: House,
        title: "Dashboard",
        to: "/dashboard",
      },
      {
        icon: MonitorPlay,
        title: "My Classes",
        to: "/study-library/live-class",
      },
      {
        icon: UsersThree,
        title: "My Referral",
        to: "/referral",
      },
    ];
  }
  return SidebarItemsData;
}

export async function filterHamburgerMenuItems(
  HamBurgerSidebarItemsData: SidebarItemsType[]
) {
  const instituteId = await getInstituteId();

  if (instituteId === HOLISTIC_INSTITUTE_ID) {
    // For holistic institute, show core items plus the 3 specific options
    return [
      {
        icon: UserCircle,
        title: "View Profile Details",
        to: "/user-profile",
      },
      {
        icon: CreditCard,
        title: "Membership Details",
        to: "/membership-details",
      },
      {
        icon: Password,
        title: "Change Password",
        to: "/change-password",
      },
      {
        icon: Headset,
        title: "Contact Support",
        to: "/support",
      },
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
  } else {
    // For other institutes, exclude the 3 specific options
    return HamBurgerSidebarItemsData.filter(
      (item) =>
        item.title !== "Membership Details" &&
        item.title !== "Change Password" &&
        item.title !== "Contact Support"
    );
  }
}
