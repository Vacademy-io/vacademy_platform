import * as React from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "@radix-ui/react-icons";

interface SidebarItemProps {
    icon: any;
    title: string;
    to: string;
    subItems?: {
        subItem: string;
        subItemLink: string;
    }[];
}

export const SidebarItem = ({ icon, title, to, subItems }: SidebarItemProps) => {
    const { state } = useSidebar();
    const router = useRouter();
    const currentRoute = router.state.location.pathname;
    const isActive = currentRoute === to;
    const [isOpen, setIsOpen] = React.useState(false);

    if (subItems && subItems.length > 0) {
        return (
            <div className="w-full px-3">
                <div
                    className={cn(
                        "group/menu-item relative w-full px-3",
                        isActive ? "bg-white" : "bg-none"
                    )}
                >
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className={cn(
                            "flex w-full cursor-pointer items-center justify-between gap-4 rounded-lg px-4 py-2",
                            isActive ? "text-primary-500" : "text-neutral-600"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            {icon &&
                                React.createElement(icon, {
                                    className: cn(
                                        state === "expanded" ? "size-7" : "size-6",
                                        isActive ? "text-primary-500" : "text-neutral-400"
                                    ),
                                    weight: "fill",
                                })}
                            <span
                                className={cn(
                                    "text-body font-regular",
                                    isActive ? "text-primary-500" : "text-neutral-600",
                                    "group-data-[collapsible=icon]:hidden"
                                )}
                            >
                                {title}
                            </span>
                        </div>
                        <ChevronDownIcon
                            className={cn(
                                "size-4 transition-transform",
                                isOpen ? "rotate-180" : "",
                                "group-data-[collapsible=icon]:hidden"
                            )}
                        />
                    </button>
                    {isOpen && (
                        <div className="mt-1 ml-4 space-y-1">
                            {subItems.map((item, index) => (
                                <Link
                                    key={index}
                                    to={item.subItemLink}
                                    className={cn(
                                        "block px-4 py-2 text-sm rounded-lg",
                                        currentRoute === item.subItemLink
                                            ? "text-primary-500 bg-primary-50"
                                            : "text-neutral-600 hover:bg-neutral-50"
                                    )}
                                >
                                    {item.subItem}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full px-3">
            <div
                className={cn(
                    "group/menu-item relative w-full px-3",
                    isActive ? "bg-white" : "bg-none"
                )}
            >
                <Link
                    to={to}
                    className={cn(
                        "flex w-full cursor-pointer items-center gap-1 rounded-lg px-4 py-2",
                        isActive ? "text-primary-500" : "text-neutral-600"
                    )}
                >
                    <div className="flex items-center gap-4">
                        {icon &&
                            React.createElement(icon, {
                                className: cn(
                                    state === "expanded" ? "size-7" : "size-6",
                                    isActive ? "text-primary-500" : "text-neutral-400"
                                ),
                                weight: "fill",
                            })}
                        <span
                            className={cn(
                                "text-body font-regular",
                                isActive ? "text-primary-500" : "text-neutral-600",
                                "group-data-[collapsible=icon]:hidden"
                            )}
                        >
                            {title}
                        </span>
                    </div>
                </Link>
            </div>
        </div>
    );
};
