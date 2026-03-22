import React from "react";
import {
  Lightbulb,
  FileQuestion,
  BookOpen,
  MessageSquareQuote,
  Repeat,
  HelpCircle,
} from "lucide-react";
import { MessageIntent } from "@/services/chatbot-api";
import { cn } from "@/lib/utils";

export interface QuickAction {
  label: string;
  icon: React.ElementType;
  prompt: string;
  intent?: MessageIntent;
}

/**
 * Returns context-aware quick action suggestions based on the current route.
 */
export const getQuickActions = (pathname: string): QuickAction[] => {
  // Slide/content pages
  if (pathname.includes("/slides") || pathname.includes("/content")) {
    return [
      {
        label: "Explain this",
        icon: Lightbulb,
        prompt: "Explain what's on this slide in simple terms",
        intent: "doubt",
      },
      {
        label: "Quiz me",
        icon: FileQuestion,
        prompt: "Quiz me on ",
        intent: "practice",
      },
      {
        label: "Summarize",
        icon: BookOpen,
        prompt: "Give me a brief summary of this slide",
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
        label: "Course overview",
        icon: BookOpen,
        prompt: "Give me an overview of this course",
        intent: "general",
      },
      {
        label: "Learning path",
        icon: Repeat,
        prompt: "What's the recommended learning path for this course?",
        intent: "general",
      },
      {
        label: "Prerequisites",
        icon: HelpCircle,
        prompt: "What are the prerequisites for this course?",
        intent: "doubt",
      },
    ];
  }

  // Assessment/quiz pages
  if (pathname.includes("/assessment") || pathname.includes("/quiz")) {
    return [
      {
        label: "Hint",
        icon: Lightbulb,
        prompt:
          "Give me a hint for this question without revealing the answer",
        intent: "doubt",
      },
      {
        label: "Explain concept",
        icon: MessageSquareQuote,
        prompt: "Explain the concept being tested in this question",
        intent: "doubt",
      },
    ];
  }

  // Default/general suggestions — all end with space so user can type before sending
  return [
    {
      label: "Help me learn",
      icon: Lightbulb,
      prompt: "Help me learn about ",
      intent: "general",
    },
    {
      label: "Ask a doubt",
      icon: HelpCircle,
      prompt: "I have a question about ",
      intent: "doubt",
    },
    {
      label: "Practice",
      icon: FileQuestion,
      prompt: "Quiz me on ",
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
  const quickActions = getQuickActions(pathname);

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
              ? "h-5 px-2 text-[10px] text-muted-foreground bg-muted/50 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20"
              : "h-6 px-2.5 text-[11px] text-muted-foreground bg-muted/50 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20",
          )}
        >
          <action.icon
            className={cn(
              "mr-1",
              compact ? "h-2.5 w-2.5" : "h-3 w-3",
            )}
          />
          {action.label}
        </button>
      ))}
    </div>
  );
};
