import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useAssessmentStore } from "@/stores/assessment-store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEffect, useState } from "react";
import {
  distribution_duration_types,
  QUESTION_TYPES,
} from "@/types/assessment";
import { processHtmlString } from "@/lib/utils";
import { Preferences } from "@capacitor/preferences";
import { NumericInputWithKeypad } from "./otherQuestionTypes/numeric";
import { ExpandableParagraph } from "./otherQuestionTypes/paragraph";
import { OneWordInput } from "./otherQuestionTypes/OneWordInput";
import { LongAnswerInput } from "./otherQuestionTypes/LongAnswerInput";

export function QuestionDisplay() {
  const {
    currentQuestion,
    currentSection,
    answers,
    setAnswer,
    markForReview,
    clearResponse,
    questionStates,
    sectionTimers,
    questionTimers,
    assessment,
    updateQuestionTimer,
    moveToNextQuestion,
    // questionTimeSpent,
    initializeQuestionTime,
    incrementQuestionTime,
  } = useAssessmentStore();

  const [playMode, setPlayMode] = useState<string | null>(null);
  const [isManualTest, setIsManualTest] = useState(false);

  useEffect(() => {
    const fetchPlayMode = async () => {
      const storedMode = await Preferences.get({
        key: "InstructionID_and_AboutID",
      });
      if (storedMode.value) {
        const parsedData = JSON.parse(storedMode.value);
        setPlayMode(parsedData.play_mode);
        setIsManualTest(parsedData.evaluation_type === "MANUAL");
      }
    };

    fetchPlayMode();
  }, []);

  const isTimeUp = sectionTimers[currentSection]?.timeLeft === 0;
  const isPracticeMode = playMode === "PRACTICE" || playMode === "SURVEY";

  useEffect(() => {
    if (!currentQuestion?.question_id) return;
    initializeQuestionTime(currentQuestion.question_id);

    const interval = setInterval(() => {
      incrementQuestionTime(currentQuestion.question_id);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuestion, initializeQuestionTime, incrementQuestionTime]);

  useEffect(() => {
    if (
      isPracticeMode ||
      !currentQuestion ||
      assessment?.distribution_duration !== distribution_duration_types.QUESTION
    )
      return;

    const timer = setInterval(() => {
      const timeLeft = questionTimers[currentQuestion.question_id] || 0;
      if (timeLeft > 0) {
        updateQuestionTimer(currentQuestion.question_id, timeLeft - 1000);
      } else {
        moveToNextQuestion();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    currentQuestion,
    assessment?.distribution_duration,
    questionTimers,
    isPracticeMode,
  ]);

  if (!currentQuestion) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Select a question to begin
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isTimeUp && !isPracticeMode) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Time is up for this section. Please move to the next available
          section.
        </AlertDescription>
      </Alert>
    );
  }

  const currentAnswer = answers[currentQuestion.question_id] || [];
  const isMarkedForReview =
    questionStates[currentQuestion.question_id]?.isMarkedForReview;
  // const isDisabled =
  //   questionStates[currentQuestion.question_id]?.isDisabled ||
  //   questionTimers[currentQuestion.question_id] === 0;

  const handleAnswerChange = (optionId: string) => {
    // if (isDisabled) return;

    const newAnswer =
      currentQuestion.question_type === QUESTION_TYPES.MCQM
        ? currentAnswer.includes(optionId)
          ? currentAnswer.filter((id) => id !== optionId)
          : [...currentAnswer, optionId]
        : [optionId];

    setAnswer(currentQuestion.question_id, newAnswer);
  };

  const calculateMarkingScheme = (marking_json: string) => {
    try {
      const marking_scheme = JSON.parse(marking_json);
      return marking_scheme;
    } catch (error) {
      console.error("Error parsing marking_json:", error);
      return 0;
    }
  };

  return (
    <div className="space-y-6 mx-auto">
      <div className="flex flex-col items-start justify-between w-full">
        <div className="w-full">
          <div className="flex items-baseline justify-between gap-5 mb-2">
            <div className="flex items-baseline gap-8">
              <span className="text-lg text-gray-700">
                Question {currentQuestion.serial_number}
              </span>
              {!isPracticeMode &&
                assessment?.distribution_duration ===
                  distribution_duration_types.QUESTION && (
                  <span className="text-base text-primary-500">
                    {new Date(questionTimers[currentQuestion.question_id] || 0)
                      .toISOString()
                      .substr(14, 5)}
                  </span>
                )}
            </div>

            <div>
              <span className="text-base text-gray-600">
                {
                  calculateMarkingScheme(currentQuestion.marking_json).data
                    .totalMark
                }{" "}
                Marks |{" "}
              </span>
              <span>{currentQuestion.question_type}</span>
            </div>
          </div>
          {<ExpandableParagraph />}

          <p className="text-lg text-gray-800">
            {processHtmlString(currentQuestion.question.content).map(
              (item, index) =>
                item.type === "text" ? (
                  <span key={index}>{item.content}</span>
                ) : (
                  <img
                    key={index}
                    src={item.content}
                    alt={`Question image ${index + 1}`}
                  />
                )
            )}
          </p>
        </div>
        {!isManualTest && (
          <div className="flex gap-2 mt-4 w-full justify-between">
            <Button
              variant="outline"
              size="sm"
              className={
                isMarkedForReview
                  ? "text-primary-500 hover:text-primary-500 hover:bg-transparent"
                  : ""
              }
              onClick={() => markForReview(currentQuestion.question_id)}
            >
              Review Later
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => clearResponse(currentQuestion.question_id)}
              disabled={currentAnswer.length === 0}
            >
              Clear Response
            </Button>
          </div>
        )}
      </div>
      {(() => {
        switch (currentQuestion.question_type) {
          case QUESTION_TYPES.NUMERIC:
            return !isManualTest && <NumericInputWithKeypad />;
          case QUESTION_TYPES.ONE_WORD:
            return !isManualTest && <OneWordInput />;
          case QUESTION_TYPES.LONG_ANSWER:
            return !isManualTest && <LongAnswerInput />;
          case QUESTION_TYPES.MCQM:
          case QUESTION_TYPES.MCQS:
          case QUESTION_TYPES.TRUE_FALSE:
            return (
              <div className="space-y-4">
                {currentQuestion?.options?.map((option, index) => (
                  <div
                    key={option.id}
                    className={`flex ${
                      isManualTest ? "flex-row" : "flex-row-reverse"
                    } items-center justify-between rounded-lg border p-4 w-full ${
                      currentAnswer.includes(option.id)
                        ? "border-primary-500 bg-primary-50"
                        : "border-gray-200"
                    }`}
                    onClick={
                      !isManualTest
                        ? () => handleAnswerChange(option.id)
                        : undefined
                    }
                  >
                    {!isManualTest && (
                      <div className="relative flex items-center">
                        <div
                          className={`w-6 h-6 border rounded-md flex items-center justify-center ${
                            currentAnswer.includes(option.id)
                              ? "bg-green-500 border-green-500"
                              : "border-gray-300"
                          }`}
                        >
                          {currentAnswer.includes(option.id) && (
                            <span className="text-white font-bold">✔</span>
                          )}
                        </div>
                      </div>
                    )}

                    <label
                      className={`flex-grow text-sm ${
                        currentAnswer.includes(option.id)
                          ? "font-semibold"
                          : "text-gray-700"
                      }`}
                    >
                      {`(${String.fromCharCode(97 + index)}) `}
                      {processHtmlString(option.text.content).map(
                        (item, index) =>
                          item.type === "text" ? (
                            <span key={index}>{item.content}</span>
                          ) : (
                            <img
                              key={index}
                              src={item.content}
                              alt={`Option ${index}`}
                            />
                          )
                      )}
                    </label>
                  </div>
                ))}
              </div>
            );
          default:
            return (
              <div className="">other question type was found</div>
            );
        }
      })()}
    </div>
  );
}
