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
                className="[.ui-play_&]:rounded-full [.ui-play_&]:transition-all [.ui-play_&]:duration-150 [.ui-play_&]:hover:scale-[1.02] [.ui-play_&]:data-[active=true]:bg-primary/10 [.ui-play_&]:data-[active=true]:border [.ui-play_&]:data-[active=true]:border-primary/20 [.ui-play_&]:data-[active=true]:shadow-sm"
            >
                <Link to={to} onClick={onClick}>
                    {icon && React.createElement(icon, {
                        weight: isActive ? "fill" : "duotone",
                        className: `size-4 [.ui-play_&]:size-5 ${isActive ? "[.ui-play_&]:text-primary" : ""}`
                    })}
                    <span className="[.ui-play_&]:font-semibold">{title}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
};
