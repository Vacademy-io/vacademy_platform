import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CaretLeft, House } from "@phosphor-icons/react";
import Avatar from "boring-avatars";
import { MyButton } from "@/components/design-system/button";
import { cn } from "@/lib/utils";
import type { ParentChildSummary } from "../-types/parent-child";

interface ParentChildShellProps {
  child?: Pick<ParentChildSummary, "childUserId" | "fullName">;
  /** show a back arrow that returns to the module home (not the picker) */
  backTo?: "home" | "picker";
  title?: string;
  children: ReactNode;
}

/**
 * Header + content wrapper for every "My Child" screen. Proper nested-route
 * shell (renders {children} from the route's <Outlet/> parent) — never a
 * useMemo tab-switch. Directional back arrow mirrors under RTL.
 */
export function ParentChildShell({ child, backTo = "home", title, children }: ParentChildShellProps) {
  const { t } = useTranslation("parent");
  const navigate = useNavigate();

  const goBack = () => {
    if (backTo === "picker" || !child) {
      navigate({ to: "/parent/child" });
    } else {
      navigate({ to: "/parent/child/$childId", params: { childId: child.childUserId } });
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl pb-safe">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <MyButton
          layoutVariant="icon"
          buttonType="text"
          onClick={goBack}
          aria-label={t("common.back")}
        >
          {backTo === "picker" ? (
            <House className="size-5" aria-hidden />
          ) : (
            <CaretLeft className={cn("size-5", "rtl:rotate-180")} aria-hidden />
          )}
        </MyButton>

        {child ? (
          <div className="flex items-center gap-2">
            <div className="size-8 overflow-hidden rounded-full border border-border">
              <Avatar size={32} name={child.fullName || child.childUserId} variant="beam" />
            </div>
            <span className="text-body font-semibold text-foreground">
              {title || child.fullName}
            </span>
          </div>
        ) : (
          <span className="text-body font-semibold text-foreground">{title}</span>
        )}
      </header>

      <main className="px-4 py-4">{children}</main>
    </div>
  );
}
