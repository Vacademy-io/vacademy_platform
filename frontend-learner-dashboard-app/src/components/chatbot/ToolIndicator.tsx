import React from "react";
import { MagnifyingGlass, BookOpen, ChartBar, SpinnerGap } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

interface ToolIndicatorProps {
  toolName: string;
}

export const ToolIndicator: React.FC<ToolIndicatorProps> = ({ toolName }) => {
  const { t } = useTranslation("chatFeatureB");
  const course = getTerminology(ContentTerms.Course, SystemTerms.Course);

  const TOOL_DISPLAY_MAP: Record<string, { label: string; icon: React.ElementType }> = {
    get_learning_progress: { label: t("toolIndicator.checkingProgress"), icon: ChartBar },
    get_student_feedback: { label: t("toolIndicator.reviewingPerformance"), icon: BookOpen },
    search_related_resources: { label: t("toolIndicator.searchingResources"), icon: MagnifyingGlass },
    semantic_search_content: { label: t("toolIndicator.searchingCourseMaterials", { course }), icon: MagnifyingGlass },
  };

  const display = TOOL_DISPLAY_MAP[toolName] || {
    label: t("toolIndicator.workingOnIt"),
    icon: SpinnerGap,
  };
  const Icon = display.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground"
    >
      <Icon className="size-3.5 animate-pulse" />
      <span>{display.label}</span>
    </motion.div>
  );
};
