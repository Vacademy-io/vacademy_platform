import { MySidebar } from "./sidebar/mySidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Navbar } from "./top-navbar.tsx/navbar";
import { SidebarHoverTrigger } from "./sidebar/sidebar-hover-trigger";
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
  return (
    <>
        <MySidebar sidebarComponent={sidebarComponent} />
      <SidebarInset>
        <Navbar />
        <div className={cn("m-4 md:m-7 max-w-full", className)}>{children}</div>
      </SidebarInset>
    </>
  );
};
