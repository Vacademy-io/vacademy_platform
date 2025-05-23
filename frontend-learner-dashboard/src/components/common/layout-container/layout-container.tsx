import { MySidebar } from "./sidebar/mySidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { Navbar } from "./top-navbar.tsx/navbar";
import { cn } from "@/lib/utils";
import React from "react";
export const LayoutContainer = ({
    children,
    className,
    sidebarComponent,
}: {
    children?: React.ReactNode;
    className?: string;
    sidebarComponent?: React.ReactNode;
}) => {
    const { open } = useSidebar();
    return (        
        <div className={`flex flex-col md:flex-row w-full ${open ? "md:gap-12" : "md:gap-16"}`}>
            <div className="w-full md:w-auto">
                <MySidebar sidebarComponent={sidebarComponent} />
            </div>

            <div className="w-full flex-1 overflow-hidden">
                <Navbar />
                <div className={cn("m-4 md:m-7 max-w-full", className)}>{children}</div>
            </div>
            {/* TODO: implement side nav bar */}
        </div>
    );
};