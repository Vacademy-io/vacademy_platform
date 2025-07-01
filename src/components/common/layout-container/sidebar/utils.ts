import { getInstituteId } from "@/constants/helper";
import { SidebarItemsType } from "../../../../types/layout-container-types";
import {
    House,
    BookOpen,
    Scroll,
    SignOut,
    NotePencil,
} from "@phosphor-icons/react";
import { UserCircle, UserCircleMinus } from "phosphor-react";
import { CODE_CIRCLE_INSTITUTE_ID } from "@/constants/urls";

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
            (item) =>
                item.title !== "Homework" && item.title !== "Assessment Centre"
        );
    }
    return SidebarItemsData;
}
