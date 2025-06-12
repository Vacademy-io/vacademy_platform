import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import React from "react";
import { SidebarGroup } from "@/components/ui/sidebar";
import { SidebarItemProps } from "@/types/layout-container/layout-container-types";
import { useSidebar } from "@/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";

export const CollapsibleItem = ({ icon, title, to, subItems }: SidebarItemProps) => {
    const [hover, setHover] = useState<boolean>(false);
    const { state, toggleSidebar } = useSidebar(); // Access sidebar state and toggle function
    const [isOpen, setIsOpen] = useState(false);

    const toggleHover = () => setHover(!hover);
    const router = useRouter();

    const currentRoute = router.state.location.pathname;
    const routeMatches =
        subItems?.some((item) => item.subItemLink && currentRoute.includes(item.subItemLink)) ||
        currentRoute === to;

    useEffect(() => {
        if (routeMatches) {
            setIsOpen(true);
        }
    }, [routeMatches]);

    return (
        <Collapsible
            className="group/collapsible"
            onMouseEnter={toggleHover}
            onMouseLeave={toggleHover}
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <Link to={to}>
                <CollapsibleTrigger
                    className="flex w-full items-center justify-between"
                    onClick={() => {
                        if (state === "collapsed") toggleSidebar(); // Open sidebar if it’s collapsed
                        setIsOpen(true);
                    }}
                >
                    <div
                        className={`flex w-full cursor-pointer items-center gap-1 rounded-lg px-4 py-2 ${
                            hover || routeMatches ? "bg-white" : "bg-none"
                        }`}
                    >
                        <div className="flex items-center">
                            {icon &&
                                React.createElement(icon, {
                                    className: `${state === "expanded" ? "size-7" : "size-6"} ${
                                        hover || routeMatches
                                            ? "text-primary-500"
                                            : "text-neutral-400"
                                    }`,
                                    weight: "fill",
                                })}
                            <SidebarGroup
                                className={`${
                                    hover || routeMatches ? "text-primary-500" : "text-neutral-600"
                                } text-body font-regular text-neutral-600 group-data-[collapsible=icon]:hidden`}
                            >
                                {title}
                            </SidebarGroup>
                        </div>
                        <SidebarGroup className="ml-auto w-fit group-data-[collapsible=icon]:hidden">
                            <ChevronDownIcon
                                className={`ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180 ${
                                    hover || routeMatches ? "text-primary-500" : "text-neutral-600"
                                }`}
                            />
                        </SidebarGroup>
                    </div>
                </CollapsibleTrigger>
            </Link>
            <CollapsibleContent>
                <SidebarGroup className="flex flex-col gap-1 pl-12 group-data-[collapsible=icon]:hidden">
                    {subItems?.map((obj, key) => (
                        <Link to={obj.subItemLink} key={key}>
                            <div
                                className={`cursor-pointer text-body font-regular text-neutral-600 hover:text-primary-500 ${
                                    obj.subItemLink && currentRoute.includes(obj.subItemLink)
                                        ? "text-primary-500"
                                        : "text-neutral-600"
                                }`}
                            >
                                {obj.subItem}
                            </div>
                        </Link>
                    ))}
                </SidebarGroup>
            </CollapsibleContent>
        </Collapsible>
    );
};
