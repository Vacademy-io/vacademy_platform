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
import { SidebarItemProps } from "../../../../types/layout-container-types";

export const CollapsibleItem = ({ icon, title, subItems, onClick }: SidebarItemProps) => {
    const router = useRouter();
    const currentRoute = router.state.location.pathname;
    const isChildActive = subItems?.some((item) => item.subItemLink === currentRoute);

    return (
        <Collapsible asChild defaultOpen={isChildActive} className="group/collapsible">
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={title} isActive={isChildActive} size="default">
                        {icon && React.createElement(icon, {
                            weight: "duotone",
                            className: "size-4"
                        })}
                        <span>{title}</span>
                        <CaretRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {subItems?.map((item) => (
                            <SidebarMenuSubItem key={item.subItem}>
                                <SidebarMenuSubButton asChild isActive={item.subItemLink === currentRoute}>
                                    <Link to={item.subItemLink} onClick={onClick}>
                                        <span>{item.subItem}</span>
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
