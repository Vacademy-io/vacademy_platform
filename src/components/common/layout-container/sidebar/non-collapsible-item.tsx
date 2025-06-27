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
            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2.5 transition-all duration-200 ease-in-out group ${
                isActive 
                    ? "bg-primary-50 text-primary-600 shadow-sm border border-primary-100" 
                    : "hover:bg-gray-50 text-gray-600 hover:text-gray-900"
            }`}
            onMouseEnter={toggleHover}
            onMouseLeave={toggleHover}
        >
            <div className={`flex-shrink-0 transition-all duration-200 ${
                isActive ? "scale-110" : hover ? "scale-105" : "scale-100"
            }`}>
                {icon &&
                    React.createElement(icon, {
                        className: `transition-colors duration-200 ${
                            isExpanded ? "w-5 h-5" : "w-5 h-5"
                        } ${
                            isActive 
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
                        isActive 
                            ? "text-primary-600 font-medium" 
                            : hover 
                                ? "text-gray-900 font-medium" 
                                : "text-gray-600 font-normal"
                    } text-base truncate`}
                >
                    {title}
                </div>
            )}
            
            {/* Active indicator */}
            {isActive && (
                <div className="ml-auto w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse flex-shrink-0"></div>
            )}
        </Link>
    );
};
