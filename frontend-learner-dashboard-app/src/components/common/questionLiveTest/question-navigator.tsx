"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAssessmentStore } from "@/stores/assessment-store";
import { ViewToggle } from "./view-toggle";
import { QuestionListView } from "./question-list-view";
import { QuestionDto } from "@/types/assessment";
import { Circle } from "@phosphor-icons/react";
import {
  getQuestionStatus,
  QUESTION_LEGEND_ORDER,
  QUESTION_STATUS_GRID_CLASS,
  QUESTION_STATUS_LABEL,
  type QuestionStatus,
} from "./question-status-colors";

interface QuestionNavigatorProps {
  onClose: () => void;
  evaluationType: string;
}

export function QuestionNavigator({
  onClose,
  evaluationType,
}: QuestionNavigatorProps) {
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const {
    assessment,
    currentSection,
    currentQuestion,
    questionStates,
    setCurrentQuestion,
    setQuestionState,
  } = useAssessmentStore();

  if (!assessment) return null;

  const currentSectionQuestions =
    assessment.section_dtos[currentSection].question_preview_dto_list;

  const handleQuestionClick = (question: QuestionDto) => {
    setCurrentQuestion(question);
    setQuestionState(question.question_id, { isVisited: true });
    onClose();
  };

  const counts = React.useMemo(() => {
    const base: Record<QuestionStatus, number> = {
      answered: 0,
      "answered-marked": 0,
      marked: 0,
      "not-answered": 0,
      "not-visited": 0,
    };
    currentSectionQuestions.forEach((question) => {
      const status = getQuestionStatus(questionStates[question.question_id]);
      base[status] += 1;
    });
    return base;
  }, [currentSectionQuestions, questionStates]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b ">
        <ViewToggle view={view} onViewChange={setView} />
      </div>

      <div className="p-4">
        {/* Status legend + counts */}
        {evaluationType !== "MANUAL" && (
          <div
            className="grid grid-cols-2 gap-2 mb-2 text-xs"
            aria-label="Question status legend"
          >
            {QUESTION_LEGEND_ORDER.map((status) => (
              <div key={status} className="flex items-center gap-2">
                <div className="relative">
                  <div
                    className={cn(
                      "w-6 h-6 rounded border flex items-center justify-center font-medium",
                      QUESTION_STATUS_GRID_CLASS[status]
                    )}
                  >
                    {counts[status]}
                  </div>
                  {(status === "marked" || status === "answered-marked") && (
                    <Circle
                      className="absolute -top-1 -right-1 w-3 h-3 text-primary-500"
                      weight="fill"
                    />
                  )}
                </div>
                <span>{QUESTION_STATUS_LABEL[status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <ScrollArea className="flex-1">
        {view === "grid" ? (
          <div className="grid grid-cols-5 gap-2 p-1 px-4">
            {currentSectionQuestions.map((question, index) => {
              const state = questionStates[question.question_id];
              const status = getQuestionStatus(state);
              const isActive =
                currentQuestion?.question_id === question.question_id;
              return (
                <div key={question.question_id} className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Question ${index + 1}, ${QUESTION_STATUS_LABEL[status]}`}
                    className={cn(
                      "w-full aspect-square text-sm font-medium p-0 border",
                      QUESTION_STATUS_GRID_CLASS[status],
                      isActive && "ring-2 ring-primary"
                    )}
                    onClick={() => handleQuestionClick(question)}
                  >
                    {index + 1}
                  </Button>
                  {state?.isMarkedForReview && (
                    <Circle
                      className="absolute -top-1 -right-1 w-3 h-3 text-primary-500"
                      weight="fill"
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <QuestionListView />
        )}
      </ScrollArea>
    </div>
  );
}
