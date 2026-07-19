import { useTranslation } from "react-i18next";
import { Question } from "@phosphor-icons/react";
import { MyButton } from "@/components/design-system/button";
import { runParentTour, type ParentTourStep } from "../-lib/parent-tour";

/** Builds the parent walkthrough steps (shared by the button and the auto-run). */
export function buildParentTourSteps(t: (k: string) => string): ParentTourStep[] {
  return [
    { element: '[data-tour="parent-search"]', title: t("tour.search.title"), description: t("tour.search.body") },
    { element: '[data-tour="attention-card"]', title: t("tour.attention.title"), description: t("tour.attention.body") },
    { element: '[data-tour="parent-tiles"]', title: t("tour.tiles.title"), description: t("tour.tiles.body") },
    { element: '[data-tour="parent-chat"]', title: t("tour.chat.title"), description: t("tour.chat.body") },
  ];
}

/** "?" button in the header — replays the guided walkthrough any time. */
export function ParentHelpButton() {
  const { t } = useTranslation("parent");
  return (
    <MyButton
      layoutVariant="icon"
      buttonType="text"
      onClick={() => runParentTour(buildParentTourSteps(t))}
      aria-label={t("tour.help")}
    >
      <Question className="size-5" aria-hidden />
    </MyButton>
  );
}
