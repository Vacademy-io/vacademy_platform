import React from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { SidebarItemProps } from "../../../../types/layout-container-types";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

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
                className={cn(
                    "relative h-10 gap-3 rounded-lg px-3 text-body font-medium [&>svg]:size-5",
                    "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
                    "data-[active=true]:bg-primary-50 data-[active=true]:text-primary-500",
                    "group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-2",
                    "[.ui-vibrant_&]:data-[active=true]:bg-primary-100",
                    "[.ui-play_&]:rounded-xl [.ui-play_&]:[&>svg]:size-6",
                    "[.ui-play_&]:data-[active=true]:bg-play-highlight [.ui-play_&]:data-[active=true]:text-play-ink"
                )}
            >
                <Link to={to} onClick={onClick}>
                    {isActive && (
                        <span
                            aria-hidden
                            className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary-500"
                        />
                    )}
                    {icon && React.createElement(icon, {
                        weight: isActive ? "fill" : "duotone",
                        className: "size-5 shrink-0"
                    })}
                    <span className="truncate">{title}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
};
