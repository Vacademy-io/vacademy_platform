import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CaretDown, Check, Eye } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChildAvatar } from "./ChildAvatar";
import { useChildren, useParentSettings } from "../-hooks/use-parent-child";
import { getParentName } from "../-lib/parent-identity";
import { startChildViewSession } from "../-services/parent-portal-api";
import { startChildView } from "../-lib/child-view";

interface ParentProfileMenuProps {
  childId: string;
  childName: string;
  childFileId?: string | null;
}

/**
 * Header identity + switcher: shows WHO is signed in (the parent), lets a
 * guardian switch between their children, and holds Log out. Clears up "whose
 * name is this" — the chip is the child being viewed; the menu names the parent.
 */
export function ParentProfileMenu({ childId, childName, childFileId }: ParentProfileMenuProps) {
  const { t } = useTranslation("parent");
  const navigate = useNavigate();
  const { data: children } = useChildren();
  const { data: settings } = useParentSettings();
  const parentName = getParentName();
  const hasMultiple = (children?.length ?? 0) > 1;
  const canViewAsChild = settings?.allowViewAsChild ?? false;
  const [switching, setSwitching] = useState(false);

  const viewAsChild = async () => {
    if (switching) return;
    setSwitching(true);
    try {
      const s = await startChildViewSession(childId);
      await startChildView({
        childUserId: s.childUserId,
        childName: s.childName || childName,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      });
      // startChildView hard-reloads into the learner dashboard on success.
    } catch (e) {
      console.error("[parent] view-as-child failed", e);
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-full py-1 pe-2",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
          )}
        >
          <div className="size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
            <ChildAvatar name={childName} fileId={childFileId} size={32} />
          </div>
          <span className="truncate text-body font-semibold text-foreground">{childName}</span>
          <CaretDown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        {parentName ? (
          <DropdownMenuLabel className="text-caption font-normal text-muted-foreground">
            {t("account.signedInAs", { name: parentName })}
          </DropdownMenuLabel>
        ) : null}
        <DropdownMenuSeparator />

        {hasMultiple ? (
          <>
            <DropdownMenuLabel className="text-caption font-normal text-muted-foreground">
              {t("account.switchChild")}
            </DropdownMenuLabel>
            {children?.map((c) => (
              <DropdownMenuItem
                key={c.childUserId}
                onClick={() =>
                  navigate({ to: "/parent/child/$childId", params: { childId: c.childUserId } })
                }
                className="gap-2"
              >
                <div className="size-6 shrink-0 overflow-hidden rounded-full">
                  <ChildAvatar name={c.fullName} size={24} />
                </div>
                <span className="truncate">{c.fullName}</span>
                {c.childUserId === childId ? (
                  <Check className="ms-auto size-4 text-primary-500" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}

        {canViewAsChild ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2" disabled={switching} onSelect={() => void viewAsChild()}>
              <Eye weight="duotone" className="size-4 text-primary-500" aria-hidden />
              <span className="truncate">{t("account.viewAsChild", { name: childName })}</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
