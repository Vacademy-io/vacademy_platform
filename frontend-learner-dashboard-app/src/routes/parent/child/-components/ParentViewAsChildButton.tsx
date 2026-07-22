import { useTranslation } from "react-i18next";
import { Eye } from "@phosphor-icons/react";
import { MyButton } from "@/components/design-system/button";
import { useViewAsChild } from "../-lib/use-view-as-child";

interface ParentViewAsChildButtonProps {
  childId: string;
  childName: string;
}

/**
 * One-tap "view as my child" in the header (beside Help) — cuts the two-click
 * profile-menu path. The backend's allowViewAsChild gate still enforces on tap.
 */
export function ParentViewAsChildButton({ childId, childName }: ParentViewAsChildButtonProps) {
  const { t } = useTranslation("parent");
  const { viewAsChild, switching } = useViewAsChild(childId, childName);

  return (
    <MyButton
      layoutVariant="icon"
      buttonType="text"
      disabled={switching}
      onClick={() => void viewAsChild()}
      aria-label={t("account.viewAsChild", { name: childName })}
    >
      <Eye weight="duotone" className="size-5 text-primary-500" aria-hidden />
    </MyButton>
  );
}
