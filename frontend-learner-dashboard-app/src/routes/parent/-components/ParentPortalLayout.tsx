/**
 * ParentPortalLayout
 * ──────────────────
 * Self-contained layout container for the parent portal,
 * mirroring the pattern of the main LayoutContainer component.
 *
 * Structure:
 *   SidebarProvider
 *     ParentPortalSidebar  (collapsible icon sidebar)
 *     SidebarInset
 *       ParentPortalNavbar (sticky top navbar)
 *       <main>             (scrollable content area)
 *         {children}
 */

import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { ChildProfile } from "@/types/parent-portal";
import { ParentPortalSidebar } from "./ParentPortalSidebar";
import { ParentPortalNavbar } from "./ParentPortalNavbar";
import type { TabId } from "./navigation-config";

interface ParentPortalLayoutProps {
  children: React.ReactNode;
  /** Currently selected child (drives sidebar header initials / info). */
  child: ChildProfile;
  allChildren: ChildProfile[];
  parentName: string;
  activeTab: TabId;
  currentTabLabel: string;
  onSwitchChild: () => void;
  /** Optional institute logo URL for the sidebar header. */
  instituteLogoUrl?: string;
  /** Optional institute name for the sidebar header. */
  instituteName?: string;
  className?: string;
}

export function ParentPortalLayout({
  children,
  child,
  allChildren,
  parentName,
  activeTab,
  currentTabLabel,
  onSwitchChild,
  instituteLogoUrl,
  instituteName,
  className,
}: ParentPortalLayoutProps) {
  return (
    <SidebarProvider>
      <ParentPortalSidebar
        child={child}
        activeTab={activeTab}
        instituteName={instituteName}
        instituteLogoUrl={instituteLogoUrl}
      />

      <SidebarInset className="overflow-x-hidden w-full">
        <ParentPortalNavbar
          title={currentTabLabel}
          parentName={parentName}
          canSwitch={allChildren.length > 1}
          onSwitchChild={onSwitchChild}
        />
        <div
          className={cn("m-4 md:m-7 max-w-full overflow-x-hidden", className)}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
