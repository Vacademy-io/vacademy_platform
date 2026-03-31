import React, { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { DotsThree } from "@phosphor-icons/react";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import type { SidebarItemsType } from "@/types/layout-container-types";
import type { StudentSidebarTabConfig } from "@/types/student-display-settings";
import {
  House,
  BookOpen,
  NotePencil,
  Scroll,
  Users,
} from "@phosphor-icons/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Same icon map as mySidebar.tsx
const ICON_MAP: Record<string, React.FC<any>> = {
  dashboard: House,
  "learning-center": BookOpen,
  homework: NotePencil,
  "assessment-center": Scroll,
  "sub-org-learners": Users,
};

const LABEL_MAP: Record<string, string> = {
  dashboard: "Home",
  "learning-center": "Learn",
  homework: "Tasks",
  "assessment-center": "Tests",
  referral: "Refer",
  attendance: "Attend",
  planning: "Plan",
};

// Short labels for bottom nav (max ~6 chars)
const SHORT_LABEL: Record<string, string> = {
  "Dashboard": "Home",
  "Learning Center": "Learn",
  "Homework": "Tasks",
  "Assessment Centre": "Tests",
  "Referral": "Refer",
  "Attendance": "Attend",
  "Planning": "Plan",
  "Sub-Org Learners": "Orgs",
};

const ROUTE_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  referral: "/referral",
  attendance: "/learning-centre/attendance",
};

function createLetterIcon(letter: string) {
  return function LetterIcon({ size = 20, className = "", weight = "regular" }: any) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-lg text-xs font-black ${className}`}
        style={{ width: size, height: size }}
      >
        {letter}
      </span>
    );
  };
}

function transformTabs(tabs: StudentSidebarTabConfig[]): SidebarItemsType[] {
  return tabs
    .filter((t) => t.visible !== false)
    .map((t) => {
      const firstRoute =
        t.route ||
        ROUTE_MAP[t.id] ||
        (t.subTabs || []).find((s) => s.visible !== false)?.route ||
        "/";

      return {
        icon: ICON_MAP[t.id] || createLetterIcon((t.label || t.id || "?").charAt(0).toUpperCase()),
        title: t.label || LABEL_MAP[t.id] || t.id || "",
        to: firstRoute,
      };
    });
}

const MAX_VISIBLE = 4;

export const PlayBottomNav: React.FC = () => {
  const [items, setItems] = useState<SidebarItemsType[]>([]);
  const router = useRouter();
  const currentRoute = router.state.location.pathname;

  useEffect(() => {
    getStudentDisplaySettings(false).then((settings) => {
      const tabs = settings?.sidebar?.tabs || [];
      setItems(transformTabs(tabs));
    });
  }, []);

  if (items.length === 0) return null;

  const visibleItems = items.slice(0, MAX_VISIBLE);
  const overflowItems = items.slice(MAX_VISIBLE);
  const hasOverflow = overflowItems.length > 0;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t-[3px] border-primary/20"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)",
        boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
      }}
    >
      <div className="flex items-stretch justify-around px-1 pt-1">
        {visibleItems.map((item, i) => {
          const isActive = item.to ? currentRoute.includes(item.to) : false;
          const Icon = item.icon;
          const shortLabel = SHORT_LABEL[item.title] || (item.title.length > 6 ? item.title.slice(0, 5) + "…" : item.title);

          return (
            <Link
              key={i}
              to={item.to || "/"}
              className="flex flex-col items-center justify-center flex-1 py-1.5 gap-0.5 transition-all duration-150"
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 ${
                  isActive
                    ? "bg-primary text-white shadow-[0_3px_0_hsl(var(--primary-500))]"
                    : "text-muted-foreground"
                }`}
              >
                {Icon &&
                  React.createElement(Icon, {
                    size: 24,
                    weight: isActive ? "fill" : "regular",
                  })}
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wide leading-none ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {shortLabel}
              </span>
            </Link>
          );
        })}

        {/* More button for overflow items */}
        {hasOverflow && (
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center flex-1 py-1.5 gap-0.5">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground">
                  <DotsThree size={24} weight="bold" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide leading-none text-muted-foreground">
                  More
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
              <SheetHeader>
                <SheetTitle className="font-black uppercase tracking-wide text-sm">
                  More
                </SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 py-4">
                {overflowItems.map((item, i) => {
                  const Icon = item.icon;
                  const isActive = item.to
                    ? currentRoute.includes(item.to)
                    : false;
                  return (
                    <Link
                      key={i}
                      to={item.to || "/"}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                        isActive
                          ? "bg-primary/10 border-primary/30"
                          : "border-transparent hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                          isActive
                            ? "bg-primary text-white shadow-[0_3px_0_hsl(var(--primary-500))]"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {Icon &&
                          React.createElement(Icon, {
                            size: 24,
                            weight: isActive ? "fill" : "regular",
                          })}
                      </div>
                      <span className="text-xs font-bold text-center">
                        {item.title}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </nav>
  );
};
