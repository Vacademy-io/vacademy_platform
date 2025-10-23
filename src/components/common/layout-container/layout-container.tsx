import { MySidebar } from "./sidebar/mySidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import { Navbar } from "./top-navbar.tsx/navbar";
import { cn } from "@/lib/utils";
import React from "react";
import useStore from "./sidebar/useSidebar";

export const LayoutContainer = ({
    children,
    className,
    sidebarComponent,
}: {
    children?: React.ReactNode;
    className?: string;
    sidebarComponent?: React.ReactNode;
}) => {
    const { setHasCustomSidebar } = useStore();
    React.useEffect(() => {
        setHasCustomSidebar(!!sidebarComponent);
        return () => setHasCustomSidebar(false);
    }, [sidebarComponent, setHasCustomSidebar]);
    return (
        <>
            <MySidebar sidebarComponent={sidebarComponent} />
            <SidebarInset className="overflow-x-hidden w-full">
                <Navbar />
                <div className={cn("m-4 md:m-7 max-w-full overflow-x-hidden", className)}>
                    {children}
                </div>
            </SidebarInset>
        </>
    );
};
