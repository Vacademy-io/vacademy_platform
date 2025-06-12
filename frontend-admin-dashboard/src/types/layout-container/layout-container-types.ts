import { IconProps } from "@phosphor-icons/react";

export interface subItemsType {
    subItem: string | undefined;
    subItemLink: string | undefined;
}

export interface SidebarItemsType {
    icon: React.FC<IconProps>;
    title: string;
    to?: string;
    subItems?: subItemsType[];
    id: string;
}
export interface SidebarItemProps {
    icon?: React.FC<IconProps>;
    title: string;
    to?: string;
    subItems?: subItemsType[];
    selectedItem?: string;
}

export interface SidebarStateType {
    state: string;
}
