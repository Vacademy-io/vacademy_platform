"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAssessmentStore } from "@/stores/assessment-store";
import { ViewToggle } from "./view-toggle";
import { QuestionListView } from "./question-list-view";
import { QuestionDto, QuestionState } from "@/types/assessment";
import { Circle } from "@phosphor-icons/react";

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

  const getQuestionButtonClass = (state: QuestionState) => {
    if (state.isAnswered)
      return "bg-green-100 hover:bg-green-200 text-green-700";
    if (!state.isVisited) return "bg-white hover:bg-gray-100 text-gray-700";
    return "bg-pink-100 hover:bg-pink-200 text-pink-700";
  };

  const getCounts = () => {
    const counts = {
      Answered: 0,
      "Not Answered": 0,
      "Not Visited": 0,
      "Marked for review": 0,
      "Answered & Marked for review": 0,
    };

    currentSectionQuestions.forEach((question) => {
      const state = questionStates[question.question_id];
      if (state) {
        if (state.isAnswered && state.isMarkedForReview) {
          counts["Answered & Marked for review"]++;
          counts["Answered"]++;
        } else if (state.isAnswered) {
          counts["Answered"]++;
        } else if (state.isMarkedForReview) {
          counts["Marked for review"]++;
          counts["Not Answered"]++;
        } else if (state.isVisited) {
          counts["Not Answered"]++;
        } else {
          counts["Not Visited"]++;
        }
      } else {
        counts["Not Visited"]++;
      }
    });

    return counts;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b ">
        <ViewToggle view={view} onViewChange={setView} />
      </div>

      <div className="p-4">
        {/* answred and not answerd section */}
        {evaluationType !== "MANUAL" && (
          <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
            {Object.entries(getCounts()).map(([key, count]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="relative">
                  <div
                    className={cn(
                      "w-6 h-6 rounded border flex items-center justify-center",
                      key === "Answered" && "bg-emerald-100 border-emerald-200",
                      key === "Not Answered" && "bg-pink-100 border-pink-200",
                      key === "Not Visited" && "bg-white border-gray-200",
                      key === "Marked for review" &&
                        "bg-pink-100 border-pink-200",
                      key === "Answered & Marked for review" &&
                        "bg-emerald-100 border-emerald-200"
                    )}
                  >
                    {count}
                  </div>
                  {(key === "Marked for review" ||
                    key === "Answered & Marked for review") && (
                    <Circle
                      className="absolute -top-1 -right-1 w-3 h-3 text-primary-500"
                      weight="fill"
                    />
                  )}
                </div>
                <span>{key}</span>
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
              const isActive =
                currentQuestion?.question_id === question.question_id;
              return (
                <div key={question.question_id} className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full aspect-square text-sm font-medium p-0",
                      state && getQuestionButtonClass(state),
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
