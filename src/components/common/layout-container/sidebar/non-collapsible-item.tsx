import React from "react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { SidebarItemProps } from "../../../../types/layout-container-types";
import { useSidebar } from "@/components/ui/sidebar";
import { useRouter } from "@tanstack/react-router";

export const NonCollapsibleItem = ({ icon, title, to }: SidebarItemProps) => {
    const [hover, setHover] = useState<boolean>(false);
    const toggleHover = () => {
        setHover(!hover);
    };

    const router = useRouter();
    const currentRoute = router.state.location.pathname;
    const isActive = to && currentRoute.includes(to);

    const { state } = useSidebar();
    const isExpanded = state === "expanded";

    return (
        <Link
            to={to}
            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-300 ease-in-out group relative overflow-hidden border ${
                isActive 
                    ? "bg-gradient-to-r from-primary-50 to-primary-100/80 text-primary-700 border border-primary-200" 
                    : "hover:bg-gradient-to-r hover:from-neutral-50 hover:to-primary-50/30 text-neutral-600 hover:text-neutral-800 hover:border-primary-200/50 border border-transparent"
            }`}
            onMouseEnter={toggleHover}
            onMouseLeave={toggleHover}
        >
            {/* Background overlay for active state */}
            {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-primary-600/10 rounded-lg"></div>
            )}
            
            <div className={`flex-shrink-0 transition-all duration-300 relative z-10 ${
                isActive ? "scale-110" : hover ? "scale-105" : "scale-100"
            }`}>
                {icon &&
                    React.createElement(icon, {
                        className: `transition-colors duration-300 ${
                            isExpanded ? "w-4 h-4" : "w-4 h-4"
                        } ${
                            isActive 
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
                        isActive 
                            ? "text-primary-700 font-semibold" 
                            : hover 
                                ? "text-neutral-800 font-medium" 
                                : "text-neutral-600 font-medium"
                    } text-sm truncate`}
                >
                    {title}
                </div>
            )}
            
            {/* Active indicator */}
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary-500 to-primary-600 rounded-r-full"></div>
            )}
            
            {/* Hover glow effect */}
            {(hover || isActive) && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary-400/5 via-primary-500/10 to-primary-600/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            )}
        </Link>
    );
};
