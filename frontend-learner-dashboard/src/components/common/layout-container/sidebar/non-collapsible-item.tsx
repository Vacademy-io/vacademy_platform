import React from "react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { SidebarGroup } from "@/components/ui/sidebar";
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

    const { state } = useSidebar();

    return (
        <Link
            to={to}
            className={`flex w-full cursor-pointer items-center gap-1 rounded-lg px-4 py-2 hover:bg-white ${
               (to && currentRoute.includes(to)) ? "bg-white" : "bg-none"
            }`}
            onMouseEnter={toggleHover}
            onMouseLeave={toggleHover}
        >
            {icon &&
                React.createElement(icon, {
                    className: `${state === "expanded" ? "size-7" : "size-6"} ${
                        hover || (to && currentRoute.includes(to)) ? "text-primary-500" : "text-neutral-400"
                    }`,
                    weight: "fill",
                })}

            <SidebarGroup
                className={`${
                    hover || (to && currentRoute.includes(to)) ? "text-primary-500" : "text-neutral-600"
                } text-body font-regular text-neutral-600 group-data-[collapsible=icon]:hidden`}
            >
                {title}
            </SidebarGroup>
        </Link>
    );
};
