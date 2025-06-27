import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import React from "react";
import { SidebarGroup } from "@/components/ui/sidebar";
import { SidebarItemProps } from "../../../../types/layout-container-types";
import { useSidebar } from "@/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";

export const CollapsibleItem = ({ icon, title, subItems }: SidebarItemProps) => {
    const [hover, setHover] = useState<boolean>(false);
    const { state, toggleSidebar } = useSidebar();

    const toggleHover = () => setHover(!hover);
    const router = useRouter();

    const currentRoute = router.state.location.pathname;
    const routeMatches = subItems?.some((item) => item.subItemLink === currentRoute);
    const isExpanded = state === "expanded";

    return (
        <Collapsible
            className="group/collapsible"
            onMouseEnter={toggleHover}
            onMouseLeave={toggleHover}
        >
            <CollapsibleTrigger
                className="flex w-full items-center justify-between"
                onClick={() => {
                    if (state === "collapsed") toggleSidebar();
                }}
            >
                <div
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 transition-all duration-200 ease-in-out group ${
                        routeMatches 
                            ? "bg-primary-50 text-primary-600 shadow-sm border border-primary-100" 
                            : "hover:bg-gray-50 text-gray-600 hover:text-gray-900"
                    }`}
                >
                    <div className={`flex-shrink-0 transition-all duration-200 ${
                        routeMatches ? "scale-105" : hover ? "scale-102" : "scale-100"
                    }`}>
                        {icon &&
                            React.createElement(icon, {
                                className: `transition-colors duration-200 w-4 h-4 ${
                                    routeMatches 
                                        ? "text-primary-600" 
                                        : hover 
                                            ? "text-gray-700" 
                                            : "text-gray-500"
                                }`,
                                weight: "fill",
                            })}
                    </div>
                    
                    {isExpanded && (
                        <div
                            className={`flex-1 min-w-0 text-left transition-all duration-200 ${
                                routeMatches 
                                    ? "text-primary-600 font-medium" 
                                    : hover 
                                        ? "text-gray-900 font-medium" 
                                        : "text-gray-600 font-normal"
                            } text-base truncate`}
                        >
                            {title}
                        </div>
                    )}
                    
                    {isExpanded && (
                        <div className="ml-auto flex-shrink-0 transition-all duration-200">
                            <ChevronDownIcon
                                className={`w-3 h-3 transition-all duration-200 group-data-[state=open]/collapsible:rotate-180 ${
                                    routeMatches 
                                        ? "text-primary-500" 
                                        : hover 
                                            ? "text-gray-700" 
                                            : "text-gray-400"
                                }`}
                            />
                        </div>
                    )}
                    
                    {/* Active indicator */}
                    {routeMatches && isExpanded && (
                        <div className="w-1 h-1 bg-primary-500 rounded-full animate-pulse flex-shrink-0"></div>
                    )}
                </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="transition-all duration-200 ease-in-out">
                {isExpanded && (
                    <SidebarGroup className="flex flex-col mt-1 ml-6 space-y-0.5">
                        {subItems?.map((obj, key) => (
                            <Link 
                                to={obj.subItemLink} 
                                key={key}
                                className="group/subitem"
                            >
                                <div
                                    className={`cursor-pointer px-2 py-1 rounded-sm transition-all duration-200 text-xs ${
                                        currentRoute === obj.subItemLink
                                            ? "text-primary-600 bg-primary-50 font-medium border border-primary-100"
                                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 font-normal"
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1 h-1 rounded-full transition-colors duration-200 ${
                                            currentRoute === obj.subItemLink 
                                                ? "bg-primary-500" 
                                                : "bg-gray-300 group-hover/subitem:bg-gray-400"
                                        }`}></div>
                                        <span className="truncate">{obj.subItem}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </SidebarGroup>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
};
