import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  XCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { QuizFeedbackData } from "./types";

interface QuizFeedbackComponentProps {
  feedback: QuizFeedbackData;
  content: string; // Pre-formatted markdown summary
}

export const QuizFeedbackComponent: React.FC<QuizFeedbackComponentProps> = ({
  feedback,
  content,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getScoreColor = () => {
    if (feedback.percentage >= 80) return "text-green-600 dark:text-green-400";
    if (feedback.percentage >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBg = () => {
    if (feedback.percentage >= 80) return "from-green-500/20 to-green-600/10";
    if (feedback.percentage >= 60) return "from-yellow-500/20 to-yellow-600/10";
    return "from-red-500/20 to-red-600/10";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-background to-muted/30 border border-border rounded-xl overflow-hidden my-3"
    >
      {/* Score Header */}
      <div className={cn("bg-gradient-to-r p-4", getScoreBg())}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {feedback.passed ? (
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Target className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-foreground">
                {feedback.passed ? "Quiz Passed! 🎉" : "Keep Practicing!"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {feedback.time_taken_seconds &&
                  `Completed in ${Math.floor(feedback.time_taken_seconds / 60)}m ${feedback.time_taken_seconds % 60}s`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className={cn("text-3xl font-bold", getScoreColor())}>
              {feedback.score}/{feedback.total}
            </div>
            <div className={cn("text-sm font-medium", getScoreColor())}>
              {feedback.percentage.toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Summary */}
      <div className="p-4">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* Recommendations */}
        {feedback.recommendations && feedback.recommendations.length > 0 && (
          <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary">
                Recommendations
              </span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {feedback.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Toggle Details */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full mt-3 h-8 text-xs"
        >
          {showDetails ? (
            <>
              Hide Question Details <ChevronUp className="h-3 w-3 ml-1" />
            </>
          ) : (
            <>
              Show Question Details <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>

        {/* Question-by-Question Feedback */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-3">
                {feedback.question_feedback.map((qf, idx) => (
                  <div
                    key={qf.question_id}
                    className={cn(
                      "p-3 rounded-lg border-l-4",
                      qf.correct
                        ? "bg-green-500/5 border-green-500"
                        : "bg-red-500/5 border-red-500"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {qf.correct ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground mb-1">
                          Question {idx + 1}
                        </p>
                        <div className="text-xs text-muted-foreground prose prose-xs dark:prose-invert">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {qf.question_text}
                          </ReactMarkdown>
                        </div>

                        <div className="mt-2 space-y-1">
                          <p className="text-xs">
                            <span className="font-medium">Your answer: </span>
                            <span
                              className={cn(
                                qf.correct ? "text-green-600" : "text-red-600"
                              )}
                            >
                              {qf.user_answer_text || "Not answered"}
                            </span>
                          </p>
                          {!qf.correct && (
                            <p className="text-xs">
                              <span className="font-medium">Correct answer: </span>
                              <span className="text-green-600">
                                {qf.correct_answer_text}
                              </span>
                            </p>
                          )}
                        </div>

                        {qf.explanation && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                            <span className="font-medium">Explanation: </span>
                            <span className="inline text-muted-foreground">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                  p: ({node: _node, ...props}) => <span {...props} />
                                }}
                              >
                                {qf.explanation}
                              </ReactMarkdown>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
