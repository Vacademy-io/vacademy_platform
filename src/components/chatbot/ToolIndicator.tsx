import React from "react";
import { Search, BookOpen, BarChart3, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const TOOL_DISPLAY_MAP: Record<string, { label: string; icon: React.ElementType }> = {
  get_learning_progress: { label: "Checking your learning progress...", icon: BarChart3 },
  get_student_feedback: { label: "Reviewing your performance data...", icon: BookOpen },
  search_related_resources: { label: "Searching for related content...", icon: Search },
  semantic_search_content: { label: "Searching your course materials...", icon: Search },
};

interface ToolIndicatorProps {
  toolName: string;
}

export const ToolIndicator: React.FC<ToolIndicatorProps> = ({ toolName }) => {
  const display = TOOL_DISPLAY_MAP[toolName] || {
    label: "Working on it...",
    icon: Loader2,
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
