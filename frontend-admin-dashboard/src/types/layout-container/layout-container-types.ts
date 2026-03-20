import { IconProps } from '@phosphor-icons/react';

export interface subItemsType {
    subItem: string | undefined;
    subItemLink: string | undefined;
    subItemId: string;
    adminOnly?: boolean;
    locked?: boolean;
}

export interface SidebarItemsType {
    icon: React.FC<IconProps>;
    title: string;
    to?: string;
    subItems?: subItemsType[];
    id: string;
    locked?: boolean;
    showForInstitute?: string;
    category?: 'LMS' | 'CRM' | 'AI';
}
export interface SidebarItemProps {
    icon?: React.FC<IconProps>;
    title: string;
    to?: string;
    subItems?: subItemsType[];
    selectedItem?: string;
    locked?: boolean;
    category?: 'LMS' | 'CRM' | 'AI';
}

export interface SidebarStateType {
    state: string;
}
