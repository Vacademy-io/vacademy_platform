import { IconProps } from "@phosphor-icons/react";

export enum sideBarStateType{
    HAMBURGER = "Hamburger sidebar",
    DEFAULT = "Defalut sidebar",
}

export interface subItemsType {
    subItem: string;
    subItemLink: string | undefined;
}

export interface SidebarItemsType {
    icon: React.FC<IconProps>;
    title: string;
    to?: string;
    subItems?: subItemsType[];
}
export interface SidebarItemProps {
    icon: React.FC<IconProps>;
    title: string;
    to?: string;
    subItems?: subItemsType[];
    selectedItem?: string;
}

export interface SidebarStateType {
    state: string;
}
