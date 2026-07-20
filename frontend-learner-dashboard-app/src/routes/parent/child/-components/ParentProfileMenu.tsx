import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CaretDown, Check, SignOut } from "@phosphor-icons/react";
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
import { useChildren } from "../-hooks/use-parent-child";
import { getParentName } from "../-lib/parent-identity";

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
  const parentName = getParentName();
  const hasMultiple = (children?.length ?? 0) > 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-full py-1 pe-2",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
          )}
        >
          <div className="size-8 shrink-0 overflow-hidden rounded-full border border-border">
            <ChildAvatar name={childName} fileId={childFileId} textClassName="text-caption" />
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
                  <ChildAvatar name={c.fullName} textClassName="text-caption" />
                </div>
                <span className="truncate">{c.fullName}</span>
                {c.childUserId === childId ? (
                  <Check className="ms-auto size-4 text-primary-500" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuItem onClick={() => navigate({ to: "/logout" })} className="gap-2">
          <SignOut className="size-4" aria-hidden />
          {t("account.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
