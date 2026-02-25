import { useParentPortalStore } from "@/stores/parent-portal-store";
import { ParentPortalLayout } from "./ParentPortalLayout";
import { type TabId, NAV_TABS } from "./navigation-config";
import { useLocation } from "@tanstack/react-router";
import { useMemo, useState } from "react";

interface ParentPageLayoutProps {
  children: React.ReactNode;
}

export function ParentPageLayout({ children }: ParentPageLayoutProps) {
  const location = useLocation();
  const {
    selectedChild,
    selectChild,
    children: allChildren,
  } = useParentPortalStore();
  const [parentName] = useState("Parent");

  // Derive active tab from URL path
  const activeTab = useMemo((): TabId => {
    const p = location.pathname || "";
    if (p.includes("/application")) return "dashboard";
    if (p.includes("/payment")) return "payments";
    if (p.includes("/schedule")) return "schedule";
    if (p.includes("/admission")) return "admission";
    if (p.includes("/documents")) return "documents";
    if (p.includes("/tracker")) return "tracker";
    return "dashboard";
  }, [location.pathname]);

  const currentTabLabel =
    NAV_TABS.find((t) => t.id === activeTab)?.label ?? "Dashboard";

  if (!selectedChild) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No child selected</p>
      </div>
    );
  }

  return (
    <ParentPortalLayout
      child={selectedChild}
      allChildren={allChildren}
      parentName={parentName}
      activeTab={activeTab}
      currentTabLabel={currentTabLabel}
      onSwitchChild={() => selectChild(null)}
    >
      {children}
    </ParentPortalLayout>
  );
}
