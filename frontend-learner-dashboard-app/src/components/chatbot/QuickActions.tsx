import React from "react";
import {
  Lightbulb,
  FileDashed,
  BookOpen,
  ChatCircleText,
  Repeat,
  Question,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { MessageIntent } from "@/services/chatbot-api";
import { cn } from "@/lib/utils";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

export interface QuickAction {
  label: string;
  icon: React.ElementType;
  prompt: string;
  intent?: MessageIntent;
}

/**
 * Returns context-aware quick action suggestions based on the current route.
 */
export const getQuickActions = (
  pathname: string,
  t: TFunction,
  course: string,
  slide: string,
): QuickAction[] => {
  // Slide/content pages
  if (pathname.includes("/slides") || pathname.includes("/content")) {
    return [
      {
        label: t("quickActions.explainThis.label"),
        icon: Lightbulb,
        prompt: t("quickActions.explainThis.prompt", { slide }),
        intent: "doubt",
      },
      {
        label: t("quickActions.quizMe.label"),
        icon: FileDashed,
        prompt: t("quickActions.quizMe.prompt"),
        intent: "practice",
      },
      {
        label: t("quickActions.summarize.label"),
        icon: BookOpen,
        prompt: t("quickActions.summarize.prompt", { slide }),
        intent: "general",
      },
    ];
  }

  // Course details page
  if (
    pathname.includes("/courses/") ||
    pathname.includes("/course-details")
  ) {
    return [
      {
        label: t("quickActions.courseOverview.label", { course }),
        icon: BookOpen,
        prompt: t("quickActions.courseOverview.prompt", { course }),
        intent: "general",
      },
      {
        label: t("quickActions.learningPath.label"),
        icon: Repeat,
        prompt: t("quickActions.learningPath.prompt", { course }),
        intent: "general",
      },
      {
        label: t("quickActions.prerequisites.label"),
        icon: Question,
        prompt: t("quickActions.prerequisites.prompt", { course }),
        intent: "doubt",
      },
    ];
  }

  // Assessment/quiz pages
  if (pathname.includes("/assessment") || pathname.includes("/quiz")) {
    return [
      {
        label: t("quickActions.hint.label"),
        icon: Lightbulb,
        prompt: t("quickActions.hint.prompt"),
        intent: "doubt",
      },
      {
        label: t("quickActions.explainConcept.label"),
        icon: ChatCircleText,
        prompt: t("quickActions.explainConcept.prompt"),
        intent: "doubt",
      },
    ];
  }

  // Default/general suggestions — all end with space so user can type before sending
  return [
    {
      label: t("quickActions.helpMeLearn.label"),
      icon: Lightbulb,
      prompt: t("quickActions.helpMeLearn.prompt"),
      intent: "general",
    },
    {
      label: t("quickActions.askDoubt.label"),
      icon: Question,
      prompt: t("quickActions.askDoubt.prompt"),
      intent: "doubt",
    },
    {
      label: t("quickActions.practice.label"),
      icon: FileDashed,
      prompt: t("quickActions.quizMe.prompt"),
      intent: "practice",
    },
  ];
};

export interface QuickActionsProps {
  /** Current route pathname — used by getQuickActions to determine context */
  pathname: string;
  /** Called when a quick action is activated. Receives the prompt text and optional intent. */
  onAction: (prompt: string, intent?: MessageIntent) => void;
  /** Disable all chips (e.g. while loading or no session) */
  disabled?: boolean;
  /**
   * Render smaller chips for the "after first message" compact mode.
   * When false/undefined, renders the larger initial-state chips.
   */
  compact?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  pathname,
  onAction,
  disabled = false,
  compact = false,
}) => {
  const { t } = useTranslation("chatFeatureB");
  const course = getTerminology(ContentTerms.Course, SystemTerms.Course);
  const slide = getTerminology(ContentTerms.Slides, SystemTerms.Slides);
  const quickActions = getQuickActions(pathname, t, course, slide);

  return (
    <div
      className={cn(
        "w-full flex flex-wrap",
        compact ? "gap-1" : "gap-1.5",
      )}
    >
      {quickActions.map((action, index) => (
        <button
          key={index}
          onClick={() => onAction(action.prompt, action.intent)}
          disabled={disabled}
          className={cn(
            "inline-flex items-center font-medium rounded-full transition-colors disabled:opacity-50",
            compact
              ? "h-5 px-2 text-caption text-muted-foreground bg-muted/50 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20"
              : "h-6 px-2.5 text-caption text-muted-foreground bg-muted/50 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20",
          )}
        >
          <action.icon
            className={cn(
              "me-1",
              compact ? "h-2.5 w-2.5" : "h-3 w-3",
            )}
          />
          {action.label}
        </button>
      ))}
    </div>
  );
};
