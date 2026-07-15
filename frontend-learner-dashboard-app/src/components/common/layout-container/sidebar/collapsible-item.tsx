import React from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { CaretRight } from "@phosphor-icons/react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { SidebarItemProps } from "../../../../types/layout-container-types";

export const CollapsibleItem = ({ icon, title, subItems, onClick }: SidebarItemProps) => {
    const router = useRouter();
    const currentRoute = router.state.location.pathname;
    const isChildActive = subItems?.some((item) => item.subItemLink === currentRoute);

    return (
        <Collapsible asChild defaultOpen={isChildActive} className="group/collapsible">
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        tooltip={title}
                        isActive={isChildActive}
                        size="default"
                        className={cn(
                            "relative h-10 gap-3 rounded-lg px-3 text-body font-medium text-nav-text [&>svg]:size-5",
                            "hover:bg-nav-surface-hover/60 focus-visible:ring-2 focus-visible:ring-ring",
                            "data-[active=true]:bg-nav-active data-[active=true]:text-nav-active-text",
                            "group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-2",
                            "[.ui-vibrant_&]:data-[active=true]:bg-primary-100",
                            "[.ui-play_&]:rounded-xl [.ui-play_&]:[&>svg]:size-6",
                            "[.ui-play_&]:data-[active=true]:bg-play-highlight [.ui-play_&]:data-[active=true]:text-play-ink"
                        )}
                    >
                        {isChildActive && (
                            <span
                                aria-hidden
                                className="absolute inset-y-2 left-0 w-1 rounded-full bg-nav-active-text"
                            />
                        )}
                        {icon && React.createElement(icon, {
                            weight: isChildActive ? "fill" : "duotone",
                            className: "size-5 shrink-0"
                        })}
                        <span className="flex-1 truncate">{title}</span>
                        <CaretRight className="ml-auto shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {subItems?.map((item) => (
                            <SidebarMenuSubItem key={item.subItem}>
                                <SidebarMenuSubButton
                                    asChild
                                    isActive={item.subItemLink === currentRoute}
                                    className={cn(
                                        "h-8 rounded-md text-body text-nav-text",
                                        "hover:bg-nav-surface-hover/60 focus-visible:ring-2 focus-visible:ring-ring",
                                        "data-[active=true]:bg-nav-active data-[active=true]:text-nav-active-text data-[active=true]:font-medium",
                                        "[.ui-vibrant_&]:data-[active=true]:bg-primary-100",
                                        "[.ui-play_&]:rounded-lg [.ui-play_&]:data-[active=true]:bg-play-highlight [.ui-play_&]:data-[active=true]:text-play-ink"
                                    )}
                                >
                                    <Link to={item.subItemLink} onClick={onClick}>
                                        <span className="truncate">{item.subItem}</span>
                                    </Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
};
