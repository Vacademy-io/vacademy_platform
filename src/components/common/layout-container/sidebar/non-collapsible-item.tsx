import React from "react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { SidebarGroup } from "@/components/ui/sidebar";
import { SidebarItemProps } from "../../../../types/layout-container-types";
import { useSidebar } from "@/components/ui/sidebar";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const NonCollapsibleItem = ({ icon, title, to }: SidebarItemProps) => {
    const [hover, setHover] = useState<boolean>(false);
    const { state } = useSidebar();
    const router = useRouter();
    const currentRoute = router.state.location.pathname;
    const isActive = currentRoute === to;

    const toggleHover = () => setHover(!hover);

    return (
        <Link
            to={to}
            className={cn(
                "flex w-full cursor-pointer items-center gap-1 rounded-lg px-4 py-2",
                hover || isActive ? "bg-white" : "bg-none"
            )}
            onMouseEnter={toggleHover}
            onMouseLeave={toggleHover}
        >
            <div className="flex items-center">
                {icon &&
                    React.createElement(icon, {
                        className: cn(
                            state === "expanded" ? "size-7" : "size-6",
                            hover || isActive ? "text-primary-500" : "text-neutral-400"
                        ),
                        weight: "fill",
                    })}
                <span
                    className={cn(
                        "text-body font-regular",
                        hover || isActive ? "text-primary-500" : "text-neutral-600",
                        "group-data-[collapsible=icon]:hidden"
                    )}
                >
                    {title}
                </span>
            </div>
        </Link>
    );
};
