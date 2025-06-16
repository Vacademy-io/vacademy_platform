import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import React from "react";
import { SidebarGroup } from "@/components/ui/sidebar";
import { SidebarItemProps } from "../../../../types/layout-container-types";
import { useSidebar } from "@/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const CollapsibleItem = ({ icon, title, subItems }: SidebarItemProps) => {
    const [hover, setHover] = useState<boolean>(false);
    const { state, toggleSidebar } = useSidebar();
    const router = useRouter();
    const currentRoute = router.state.location.pathname;
    const routeMatches = subItems?.some((item) => item.subItemLink === currentRoute);

    const toggleHover = () => setHover(!hover);

    return (
        <Collapsible
            className="group/collapsible"
            onMouseEnter={toggleHover}
            onMouseLeave={toggleHover}
        >
            <CollapsibleTrigger
                className={cn(
                    "flex w-full items-center justify-between",
                    hover || routeMatches ? "bg-white" : "bg-none"
                )}
                onClick={() => {
                    if (state === "collapsed") toggleSidebar();
                }}
            >
                <div className="flex w-full cursor-pointer items-center gap-1 rounded-lg px-4 py-2">
                    <div className="flex items-center">
                        {icon &&
                            React.createElement(icon, {
                                className: cn(
                                    state === "expanded" ? "size-7" : "size-6",
                                    hover || routeMatches ? "text-primary-500" : "text-neutral-400"
                                ),
                                weight: "fill",
                            })}
                        <span
                            className={cn(
                                "text-body font-regular",
                                hover || routeMatches ? "text-primary-500" : "text-neutral-600",
                                "group-data-[collapsible=icon]:hidden"
                            )}
                        >
                            {title}
                        </span>
                    </div>
                    <ChevronDownIcon
                        className={cn(
                            "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
                            hover || routeMatches ? "text-primary-500" : "text-neutral-400",
                            "group-data-[collapsible=icon]:hidden"
                        )}
                    />
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1">
                {subItems?.map((item, index) => (
                    <Link
                        key={index}
                        to={item.subItemLink}
                        className={cn(
                            "flex w-full cursor-pointer items-center gap-1 rounded-lg px-4 py-2",
                            currentRoute === item.subItemLink ? "bg-white" : "bg-none"
                        )}
                    >
                        <span
                            className={cn(
                                "text-body font-regular",
                                currentRoute === item.subItemLink ? "text-primary-500" : "text-neutral-600",
                                "group-data-[collapsible=icon]:hidden"
                            )}
                        >
                            {item.subItemTitle}
                        </span>
                    </Link>
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
};
