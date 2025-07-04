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
    const isExpanded = state === "expanded";

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
                <div
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-300 ease-in-out group relative overflow-hidden ${
                        routeMatches 
                            ? "bg-gradient-to-r from-primary-50 to-primary-100/80 text-primary-700 border border-primary-200" 
                            : "hover:bg-gradient-to-r hover:from-neutral-50 hover:to-primary-50/30 text-neutral-600 hover:text-neutral-800 hover:border-primary-200/50 border border-transparent"
                    }`}
                >
                    {/* Background overlay for active state */}
                    {routeMatches && (
                        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-primary-600/10 rounded-lg"></div>
                    )}
                    
                    <div className={`flex-shrink-0 transition-all duration-300 relative z-10 ${
                        routeMatches ? "scale-110" : hover ? "scale-105" : "scale-100"
                    }`}>
                        {icon &&
                            React.createElement(icon, {
                                className: `transition-colors duration-300 w-4 h-4 ${
                                    routeMatches 
                                        ? "text-primary-600" 
                                        : hover 
                                            ? "text-primary-500" 
                                            : "text-neutral-500"
                                }`,
                                weight: "duotone",
                            })}
                    </div>
                    
                    {isExpanded && (
                        <div
                            className={`flex-1 min-w-0 text-left transition-all duration-300 relative z-10 ${
                                routeMatches 
                                    ? "text-primary-700 font-semibold" 
                                    : hover 
                                        ? "text-neutral-800 font-medium" 
                                        : "text-neutral-600 font-medium"
                            } text-sm truncate`}
                        >
                            {title}
                        </div>
                    )}
                    
                    {isExpanded && (
                        <div className="ml-auto flex-shrink-0 transition-all duration-300 relative z-10">
                            <ChevronDownIcon
                                className={`w-3 h-3 transition-all duration-300 group-data-[state=open]/collapsible:rotate-180 ${
                                    routeMatches 
                                        ? "text-primary-600" 
                                        : hover 
                                            ? "text-primary-500" 
                                            : "text-neutral-400"
                                }`}
                            />
                        </div>
                    )}
                    
                    {/* Active indicator */}
                    {routeMatches && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary-500 to-primary-600 rounded-r-full"></div>
                    )}
                </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="transition-all duration-300 ease-in-out">
                {isExpanded && (
                    <SidebarGroup className="flex flex-col mt-2 ml-4 space-y-1 relative">
                        {/* Connection line */}
                        <div className="absolute left-2 top-0 bottom-0 w-px bg-gradient-to-b from-primary-200 via-primary-300/50 to-transparent"></div>
                        
                        {subItems?.map((obj, key) => (
                            <Link 
                                to={obj.subItemLink} 
                                key={key}
                                className="group/subitem relative"
                            >
                                <div
                                    className={`cursor-pointer px-3 py-2 rounded-md transition-all duration-300 text-xs relative overflow-hidden border ${
                                        currentRoute === obj.subItemLink
                                            ? "text-primary-700 bg-gradient-to-r from-primary-50 to-primary-100/60 font-medium border border-primary-200"
                                            : "text-neutral-500 hover:text-neutral-700 hover:bg-gradient-to-r hover:from-neutral-50 hover:to-primary-50/20 font-normal border-transparent hover:border-primary-200/30"
                                    }`}
                                >
                                    {/* Active background overlay */}
                                    {currentRoute === obj.subItemLink && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary-400/10 to-primary-500/5 rounded-md"></div>
                                    )}
                                    
                                    <div className="flex items-center gap-2.5 relative z-10">
                                        {/* Branch indicator */}
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                                                currentRoute === obj.subItemLink 
                                                    ? "bg-primary-500" 
                                                    : "bg-neutral-300 group-hover/subitem:bg-primary-400"
                                            }`}></div>
                                            <div className={`w-3 h-px transition-colors duration-300 ${
                                                currentRoute === obj.subItemLink 
                                                    ? "bg-primary-300" 
                                                    : "bg-neutral-200 group-hover/subitem:bg-primary-300"
                                            }`}></div>
                                        </div>
                                        <span className="truncate">{obj.subItem}</span>
                                    </div>
                                    
                                    {/* Active indicator line */}
                                    {currentRoute === obj.subItemLink && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-primary-500 to-primary-600 rounded-r-full"></div>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </SidebarGroup>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
};
