import React from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { SidebarItemProps } from "../../../../types/layout-container-types";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export const NonCollapsibleItem = ({ icon, title, to, onClick }: SidebarItemProps) => {
    const router = useRouter();
    const currentRoute = router.state.location.pathname;
    const isActive = to ? currentRoute.includes(to) : false;

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={title}
                size="default"
                className=""
            >
                <Link to={to} onClick={onClick}>
                    {icon && React.createElement(icon, {
                        weight: isActive ? "fill" : "duotone",
                        className: "size-4"
                    })}
                    <span>{title}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
};
