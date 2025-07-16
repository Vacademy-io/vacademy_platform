import React, { useState } from "react";
import { CheckCircle } from "lucide-react";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";
import { Textarea } from "@/components/ui/textarea";

interface Option {
  id: string;
  text: { content: string };
}

interface Question {
  id: string;
  text_data: { content: string };
  options: Option[];
  question_type?: string;
}

interface QuizViewerProps {
  questions: Question[];
  onAnswer: (questionId: string, selectedOptionId: string | number | string[]) => void;
  onComplete?: () => void;
}





export const QuizViewer: React.FC<QuizViewerProps> = ({ questions, onAnswer, onComplete }) => {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: string | number | string[] }>({});
  const [numericErrors, setNumericErrors] = useState<{ [questionId: string]: string }>({});

  if (!questions || questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 text-gray-400 text-2xl font-bold">?</div>
          </div>
          <p className="text-gray-500">No quiz questions available.</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[current];
  const total = questions.length;
  const questionType = currentQuestion.question_type || "MCQS";

  const handleOptionSelect = (optionId: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
    onAnswer(currentQuestion.id, optionId);
  };

  const handleTextInput = (value: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    onAnswer(currentQuestion.id, value);
  };

  const handleNumericInput = (value: string) => {
    // Check if the input is a valid number
    const isNumeric = /^\d*\.?\d*$/.test(value);
    
    if (value === "") {
      setNumericErrors((prev) => ({ ...prev, [currentQuestion.id]: "" }));
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: "" }));
      onAnswer(currentQuestion.id, "");
    } else if (!isNumeric) {
      setNumericErrors((prev) => ({ ...prev, [currentQuestion.id]: "Please enter a valid number" }));
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
      onAnswer(currentQuestion.id, value);
    } else {
      setNumericErrors((prev) => ({ ...prev, [currentQuestion.id]: "" }));
      const numericValue = parseFloat(value) || 0;
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: numericValue }));
      onAnswer(currentQuestion.id, numericValue);
    }
  };

  // For MCQM (multiple choice, multiple answers)
  const handleMultiOptionSelect = (optionId: string) => {
    let current = Array.isArray(answers[currentQuestion.id]) ? [...(answers[currentQuestion.id] as string[])] : [];
    if (current.includes(optionId)) {
      current = current.filter((id) => id !== optionId);
    } else {
      current.push(optionId);
    }
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: current }));
    onAnswer(currentQuestion.id, current);
  };

  const handlePrev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  const handleNext = () => {
    if (current < total - 1) {
      setCurrent(current + 1);
    } else if (onComplete) {
      onComplete();
    }
  };

  // Progress bar width
  const progress = ((current + 1) / total) * 100;

  // Render input based on question type
  const renderInput = () => {
    const currentAnswer = answers[currentQuestion.id];

    switch (questionType) {
            case "CNUMERIC":
      case "NUMERIC":
        return (
          <div className="space-y-3 sm:space-y-4 mt-4">
            <MyInput
              inputType="text"
              input={String(currentAnswer || "")}
              onChangeFunction={(e) => handleNumericInput(e.target.value)}
              inputPlaceholder="Enter numeric value"
              inputMode="numeric"
              className={`text-sm py-3 font-normal w-full border-primary-100 focus:border-primary-500 focus:ring-primary-500 ${
                numericErrors[currentQuestion.id] ? "border-danger-600 focus:border-danger-600 focus:ring-danger-600" : ""
              }`}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
            />
            {numericErrors[currentQuestion.id] && (
              <p className="text-danger-600 text-sm mt-1">{numericErrors[currentQuestion.id]}</p>
            )}
          </div>
        );

      case "ONE_WORD":
      case "TEXT":
        return (
          <div className="w-full mt-2 sm:mt-4">
            <MyInput
              inputType="text"
              input={String(currentAnswer || "")}
              onChangeFunction={(e) => handleTextInput(e.target.value)}
              inputPlaceholder="Type your answer"
              className="text-sm py-3 font-normal w-full border-primary-100 focus:border-primary-500 focus:ring-primary-500"
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
            />
          </div>
        );

      case "LONG_ANSWER":
        return (
          <div className="w-full mt-2 sm:mt-4">
            <Textarea
              value={currentAnswer || ""}
              onChange={(e) => handleTextInput(e.target.value)}
              placeholder="Type your answer..."
              className="min-h-[150px] sm:min-h-[200px] text-sm w-full border-primary-100 focus:border-primary-500 focus:ring-primary-500"
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
            />
          </div>
        );

      case "MCQM":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4">
            {currentQuestion.options.map((option, index) => {
              const selected = Array.isArray(currentAnswer) && currentAnswer.includes(option.id);
              return (
                <div
                  key={option.id}
                  onClick={() => handleMultiOptionSelect(option.id)}
                  className={`flex items-center space-x-3 rounded-md border p-3 w-full cursor-pointer transition-all duration-200 select-none
                    ${selected
                      ? "border-primary-500 text-primary-700"
                      : "border-primary-100 hover:border-primary-500 text-neutral-700"}
                  `}
                  style={{ userSelect: "none" }}
                >
                  <div className="relative flex items-center">
                    <div
                      className={`w-5 h-5 border rounded-md flex items-center justify-center transition-colors
                        ${selected ? "bg-primary-500 border-primary-500" : "border-primary-200 bg-white"}
                      `}
                    >
                      {selected && <span className="text-white text-sm">✓</span>}
                    </div>
                  </div>
                  <label
                    className={`flex items-center text-sm ${selected ? "font-medium text-primary-700" : "text-neutral-700"}`}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(97 + index)}.</span>
                    <span dangerouslySetInnerHTML={{ __html: option.text.content }} />
                  </label>
                </div>
              );
            })}
          </div>
        );
      case "MCQS":
      case "TRUE_FALSE":
      default:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4">
            {currentQuestion.options.map((option, index) => {
              const selected = currentAnswer === option.id;
              return (
                <div
                  key={option.id}
                  onClick={() => handleOptionSelect(option.id)}
                  className={`flex items-center space-x-3 rounded-md border p-3 w-full cursor-pointer transition-all duration-200 select-none
                    ${selected
                      ? "border-primary-500 text-primary-700"
                      : "border-primary-100 hover:border-primary-500 text-neutral-700"}
                  `}
                  style={{ userSelect: "none" }}
                >
                  <div className="relative flex items-center">
                    <div
                      className={`w-5 h-5 border rounded-md flex items-center justify-center transition-colors
                        ${selected ? "bg-primary-500 border-primary-500" : "border-primary-200 bg-white"}
                      `}
                    >
                      {selected && <span className="text-white text-sm">✓</span>}
                    </div>
                  </div>
                  <label
                    className={`flex items-center text-sm ${selected ? "font-medium text-primary-700" : "text-neutral-700"}`}
                  >
                    {questionType === "TRUE_FALSE" ? (
                      <span dangerouslySetInnerHTML={{ __html: option.text.content }} />
                    ) : (
                      <>
                        <span className="font-medium mr-2">{String.fromCharCode(97 + index)}.</span>
                        <span dangerouslySetInnerHTML={{ __html: option.text.content }} />
                      </>
                    )}
                  </label>
                </div>
              );
            })}
          </div>
        );
    }
  };

  // Check if current question is answered
  const isAnswered = () => {
    const currentAnswer = answers[currentQuestion.id];
    if (!currentAnswer) return false;
    
    switch (questionType) {
      case "CNUMERIC":
      case "NUMERIC":
        return typeof currentAnswer === "number" && currentAnswer !== 0;
      case "MCQM":
      case "MULTIPLE_CHOICE":
        return Array.isArray(currentAnswer) && currentAnswer.length > 0;
      default:
        return typeof currentAnswer === "string" && currentAnswer.trim() !== "";
    }
  };

  return (
    <div className="w-full min-h-[80vh] bg-white rounded-xl shadow-lg p-4 sm:p-8">
      {/* Question X of Y and Progress bar */}
      <div className="mb-8">
        <div className="mb-2">
          <span className="text-sm text-gray-700 font-medium">Question {current + 1} of {total}</span>
        </div>
        <div className="w-full h-3 rounded-full overflow-hidden bg-primary-100">
          <div
            className="h-3 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-primary-500 to-primary-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>


      {/* Question Content */}
      <div className="mb-8">
        <div 
          className="text-sm font-medium text-gray-900 mb-6 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: currentQuestion.text_data.content }}
        />
        {renderInput()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <MyButton
          buttonType="secondary"
          scale="medium"
          disable={current === 0}
          onClick={handlePrev}
          className="flex items-center justify-center min-w-[120px] space-x-2"
        >
          <span>←</span>
          <span>Previous</span>
        </MyButton>

        <div className="flex items-center space-x-2">
          {isAnswered() && (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          <span className="text-sm text-gray-500">
            {isAnswered() ? "Answered" : "Not answered"}
          </span>
        </div>

        <MyButton
          buttonType="primary"
          scale="medium"
          disable={!isAnswered()}
          onClick={handleNext}
          className="flex items-center justify-center min-w-[120px] space-x-2"
        >
          <span>{current === total - 1 ? "Finish" : "Next"}</span>
          {current !== total - 1 && <span>→</span>}
        </MyButton>
      </div>
    </div>
  );
};

export default QuizViewer;
