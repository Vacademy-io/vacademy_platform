import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CaretLeft, House, SignOut } from "@phosphor-icons/react";
import { MyButton } from "@/components/design-system/button";
import { cn } from "@/lib/utils";
import { ParentChatbot } from "./ParentChatbot";
import { ParentProfileMenu } from "./ParentProfileMenu";
import { ParentHelpButton } from "./ParentHelpButton";
import { useChildOverview } from "../-hooks/use-parent-child";

interface ParentChildShellProps {
  childId: string;
  /** back arrow target: the child's home, or the picker */
  backTo?: "home" | "picker";
  children: ReactNode;
}

/**
 * Header + content wrapper for every "My Child" screen. Resolves the child from
 * childId itself (cached), so the header profile chip, avatar and chatbot always
 * show the real child. The header identity is the CHILD being viewed (switchable
 * via the profile menu); per-screen titles live in the screen content, not here.
 * Renders {children} from the route (proper nesting, never a useMemo tab-switch).
 */
export function ParentChildShell({ childId, backTo = "home", children }: ParentChildShellProps) {
  const { t } = useTranslation("parent");
  const navigate = useNavigate();
  const { data: overview } = useChildOverview(childId);
  const childName = overview?.child?.fullName || t("common.yourChild");

  const goBack = () => {
    if (backTo === "picker") {
      navigate({ to: "/parent/child" });
    } else {
      navigate({ to: "/parent/child/$childId", params: { childId } });
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl pb-safe">
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

        <ParentProfileMenu
          childId={childId}
          childName={childName}
          childFileId={overview?.child?.profilePicFileId}
        />

        <div className="ms-auto flex items-center gap-1">
          <ParentHelpButton />
          <MyButton
            layoutVariant="icon"
            buttonType="text"
            onClick={() => navigate({ to: "/logout" })}
            aria-label={t("account.logout")}
          >
            <SignOut className="size-5" aria-hidden />
          </MyButton>
        </div>
      </header>

      {/* pb clears the fixed bottom navigation (Home · bot · student view) */}
      <main className="px-4 pb-28 pt-4">{children}</main>

      <ParentChatbot childId={childId} childName={childName} />
    </div>
  );
}
