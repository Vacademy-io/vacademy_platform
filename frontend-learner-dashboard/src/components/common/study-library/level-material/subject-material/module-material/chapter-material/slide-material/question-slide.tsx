"use client";

import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { MyInput } from "@/components/design-system/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MyButton } from "@/components/design-system/button";

interface Option {
  id: string;
  text: {
    content: string;
  };
  explanation_text_data: {
    content: string;
  };
}

interface QuestionSlideProps {
  questionData: {
    parent_rich_text: {
      content: string;
    };
    text_data: {
      content: string;
    };
    explanation_text_data: {
      content: string;
    };
    options: Option[];
    re_attempt_count: number;
    auto_evaluation_json: string;
    question_type: string;
    options_json?: string;
  };
  onSubmit: (
    questionId: string,
    selectedOption: string | string[]
  ) => Promise<any>;
}

const QuestionSlide = ({ questionData, onSubmit }: QuestionSlideProps) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<
    "idle" | "submitted" | "correct" | "incorrect"
  >("idle");
  const [attempts, setAttempts] = useState(0);
  const [correctOption, setCorrectOption] = useState<string | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // For numeric and one-word input
  const [inputValue, setInputValue] = useState<string>("");
  const [numericValue, setNumericValue] = useState<string>("");
  const [isDecimal, setIsDecimal] = useState(false);
  const [maxDecimals, setMaxDecimals] = useState(0);

  const maxAttempts = questionData?.re_attempt_count || 1;
  const questionType = questionData?.question_type || "MCQS";

  // Parse auto evaluation JSON to find correct answer
  useEffect(() => {
    try {
      if (questionData?.auto_evaluation_json) {
        const evaluationData = JSON.parse(questionData.auto_evaluation_json);

        if (questionType === "MCQS") {
          // For multiple choice questions
          if (evaluationData.data?.correctOptionIds) {
            const correctIndex = parseInt(
              evaluationData.data.correctOptionIds[0]
            );
            setCorrectOption(questionData.options[correctIndex]?.id);
          } else {
            // If not specified, assume first option is correct (for demo)
            setCorrectOption(questionData.options[0]?.id);
          }
        } else if (questionType === "ONE_WORD" || questionType === "NUMERIC") {
          // For one-word or numeric questions
          if (evaluationData.data?.correctAnswer) {
            setCorrectAnswer(evaluationData.data.correctAnswer);
          }
        }
      } else if (questionType === "MCQS") {
        // Default to first option if no evaluation data
        setCorrectOption(questionData.options[0]?.id);
      }

      // Parse options_json for numeric type questions
      if (questionType === "NUMERIC" && questionData.options_json) {
        const options = JSON.parse(questionData.options_json);
        setIsDecimal(options.numeric_type === "DECIMAL");
        setMaxDecimals(options.decimals || 0);
      }
    } catch (error) {
      console.error("Error parsing JSON data:", error);
      if (questionType === "MCQS") {
        setCorrectOption(questionData.options[0]?.id);
      }
    }
  }, [questionData, questionType]);

  const handleOptionSelect = (optionId: string) => {
    if (submissionState === "idle") {
      setSelectedOption(optionId);
    }
  };

  // Handle direct input changes for one-word questions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // Handle numeric input changes
  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Validate input based on numeric type (INTEGER or DECIMAL)
    if (isDecimal) {
      if (/^-?\d*\.?\d*$/.test(value)) {
        // Check decimal places don't exceed max
        if (value.includes(".")) {
          const parts = value.split(".");
          if (parts[1].length <= maxDecimals) {
            setNumericValue(value);
          }
        } else {
          setNumericValue(value);
        }
      }
    } else {
      // Integer only
      if (/^-?\d*$/.test(value)) {
        setNumericValue(value);
      }
    }
  };

  // Handle keypad button press for numeric input
  const handleKeyPress = (key: string) => {
    if (key === "backspace") {
      setNumericValue((prev) => prev.slice(0, -1));
    } else if (key === "clear") {
      setNumericValue("");
    } else if (key === "." && isDecimal && !numericValue.includes(".")) {
      setNumericValue((prev) => prev + ".");
    } else if (/[0-9]/.test(key)) {
      setNumericValue((prev) => {
        // If there's a decimal point, check we don't exceed max decimal places
        if (prev.includes(".")) {
          const parts = prev.split(".");
          if (parts[1].length >= maxDecimals) {
            return prev;
          }
        }
        return prev + key;
      });
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Check if we have a valid answer to submit
    if (
      (questionType === "MCQS" && !selectedOption) ||
      (questionType === "ONE_WORD" && !inputValue.trim()) ||
      (questionType === "NUMERIC" && !numericValue.trim())
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      let submissionValue: string | string[];

      // Prepare submission value based on question type
      if (questionType === "MCQS") {
        submissionValue = selectedOption || "";
      } else if (questionType === "ONE_WORD") {
        submissionValue = inputValue.trim();
      } else if (questionType === "NUMERIC") {
        submissionValue = numericValue.trim();
      } else {
        submissionValue = "";
      }

      // Call the onSubmit function passed from parent
      const result = await onSubmit(
        questionData?.parent_rich_text?.content || "unknown",
        submissionValue
      );

      // Increment attempts
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (result.success) {
        let isAnswerCorrect = false;

        // Check if answer is correct based on question type
        if (questionType === "MCQS") {
          isAnswerCorrect = selectedOption === correctOption;
        } else if (questionType === "ONE_WORD" || questionType === "NUMERIC") {
          // This logic would depend on how you want to compare answers
          // Could be exact match, case-insensitive, or using a range for numeric
          isAnswerCorrect = submissionValue === correctAnswer;
        }

        if (isAnswerCorrect) {
          setSubmissionState("correct");
          // Set explanation for correct answer
          if (questionType === "MCQS") {
            const option = questionData.options.find(
              (opt) => opt.id === selectedOption
            );
            setExplanation(
              option?.explanation_text_data?.content ||
                questionData.explanation_text_data?.content ||
                ""
            );
          } else {
            setExplanation(questionData.explanation_text_data?.content || "");
          }
        } else {
          setSubmissionState("incorrect");

          // If max attempts reached, show correct answer
          if (newAttempts >= maxAttempts) {
            if (questionType === "MCQS") {
              // Find explanation for correct option
              const correctOptionData = questionData.options.find(
                (opt) => opt.id === correctOption
              );
              setExplanation(
                correctOptionData?.explanation_text_data?.content ||
                  questionData.explanation_text_data?.content ||
                  ""
              );
            } else {
              setExplanation(
                `The correct answer is: ${correctAnswer}. ${questionData.explanation_text_data?.content || ""}`
              );
            }
          } else if (questionType === "MCQS") {
            // Show explanation for incorrect option
            const option = questionData.options.find(
              (opt) => opt.id === selectedOption
            );
            setExplanation(option?.explanation_text_data?.content || "");
          } else {
            setExplanation("That's not correct. Try again.");
          }
        }
      } else {
        // Handle API error
        console.error("Error submitting answer:", result.error);
      }
    } catch (error) {
      console.error("Error in submission:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (attempts < maxAttempts) {
      setSubmissionState("idle");
      setSelectedOption(null);
      setInputValue("");
      setNumericValue("");
      setExplanation("");
    }
  };

  // Determine if submit button should be disabled
  const isSubmitDisabled =
    isSubmitting ||
    submissionState === "correct" ||
    (submissionState === "incorrect" && attempts >= maxAttempts) ||
    (questionType === "MCQS" && !selectedOption) ||
    (questionType === "ONE_WORD" && !inputValue.trim()) ||
    (questionType === "NUMERIC" && !numericValue.trim());

  // Render the appropriate question component based on question type
  const renderQuestionContent = () => {
    switch (questionType) {
      case "MCQS":
        return (
          <div className="space-y-3">
            {questionData?.options?.map((option, index) => (
              <div
                key={option.id}
                onClick={() => handleOptionSelect(option.id)}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedOption === option.id
                    ? submissionState === "correct"
                      ? "border-green-500 bg-green-50"
                      : submissionState === "incorrect" &&
                          attempts >= maxAttempts &&
                          option.id === correctOption
                        ? "border-green-500 bg-green-50"
                        : submissionState === "incorrect"
                          ? "border-red-500 bg-red-50"
                          : "border-orange-500 bg-orange-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex-1">
                  <span className="text-neutral-600">
                    ({String.fromCharCode(97 + index)}) {option.text.content}
                  </span>
                </div>
                <div className="ml-2">
                  {selectedOption === option.id &&
                    (submissionState === "correct" ||
                    (submissionState === "incorrect" &&
                      attempts >= maxAttempts &&
                      option.id === correctOption) ? (
                      // <Check className="h-5 w-5 text-green-500" />
                      <span className="text-white font-bold">✔</span>
                    ) : submissionState === "incorrect" &&
                      selectedOption === option.id ? (
                      <X className="h-5 w-5 text-red-500" />
                    ) : (
                      <div className="h-5 w-5 border border-gray-300 rounded-sm"></div>
                    ))}
                  {selectedOption !== option.id &&
                    (submissionState !== "idle" &&
                    option.id === correctOption ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="h-5 w-5 border border-gray-300 rounded-sm"></div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        );

      case "ONE_WORD":
        return (
          <div className="w-full max-w-md mx-auto mt-4">
            <MyInput
              inputType="text"
              input={inputValue}
              onChangeFunction={handleInputChange}
              inputPlaceholder="Type your one-word answer"
              className="text-xl py-4 font-medium w-full"
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
            />

            {submissionState === "incorrect" && attempts >= maxAttempts && (
              <div className="mt-4 text-green-700">
                <p>Correct answer: {correctAnswer}</p>
              </div>
            )}
          </div>
        );

      case "NUMERIC":
        return (
          <div className="space-y-4 mt-6">
            <div className="flex justify-center">
              <MyInput
                inputType="text"
                input={numericValue}
                onChangeFunction={handleNumericChange}
                inputPlaceholder={
                  isDecimal ? "Enter decimal value" : "Enter integer value"
                }
                inputMode="numeric"
                className="text-xl py-4 font-medium w-full max-w-md"
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
              />
            </div>

            <Card className="max-w-md mx-auto">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-2">
                  {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                    <Button
                      key={num}
                      variant="outline"
                      className="h-14 text-xl font-medium"
                      onClick={() => handleKeyPress(num.toString())}
                    >
                      {num}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    className="h-14 text-xl font-medium"
                    onClick={() => handleKeyPress("0")}
                  >
                    0
                  </Button>
                  {isDecimal && (
                    <Button
                      variant="outline"
                      className="h-14 text-xl font-medium"
                      onClick={() => handleKeyPress(".")}
                      disabled={numericValue.includes(".")}
                    >
                      .
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="h-14 text-xl font-medium"
                    onClick={() => handleKeyPress("backspace")}
                  >
                    ←
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button
                    variant="outline"
                    className="h-14"
                    onClick={() => handleKeyPress("clear")}
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            {submissionState === "incorrect" && attempts >= maxAttempts && (
              <div className="mt-4 text-green-700">
                <p>Correct answer: {correctAnswer}</p>
              </div>
            )}
          </div>
        );

      default:
        return <p>Unsupported question type: {questionType}</p>;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-6">
      <h2
        className="text-xl font-semibold text-neutral-800 mb-4"
        dangerouslySetInnerHTML={{
          __html: `Question: ${questionData?.text_data?.content}`,
        }}
      />

      {/* Question image or diagram if available */}
      {/* {questionData?.media_id && (
        <div className="mb-4">
          <img
            src="/placeholder.svg?height=200&width=400"
            alt="Question diagram"
            className="mx-auto rounded-lg"
          />
          <p className="text-sm text-neutral-500 mt-1 text-center">
            Question image
          </p>
        </div>
      )} */}

      <div className="mt-6">
        <h3 className="text-lg font-medium text-neutral-700 mb-3">
          {questionType === "MCQS"
            ? "Answer:"
            : questionType === "ONE_WORD"
              ? "Enter your answer:"
              : "Enter numeric value:"}
        </h3>

        {renderQuestionContent()}
      </div>

      {/* Feedback and explanation */}
      {submissionState !== "idle" && (
        <div
          className={`mt-6 p-4 rounded-lg ${
            submissionState === "correct"
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          <h4
            className={`font-medium ${
              submissionState === "correct" ? "text-green-700" : "text-red-700"
            }`}
          >
            {submissionState === "correct"
              ? "Correct Answer!"
              : attempts >= maxAttempts
                ? "Incorrect. No more attempts left."
                : `Incorrect. Attempts: ${attempts}/${maxAttempts}`}
          </h4>
          {explanation && (
            <p className="mt-2 text-neutral-600">
              <span className="font-medium">Explanation:</span> {explanation}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-center">
        {submissionState === "incorrect" && attempts < maxAttempts ? (
          <button
            onClick={handleRetry}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            Retry
          </button>
        ) : (
          <MyButton
            type="button"
            scale="large"
            buttonType="primary"
            layoutVariant="default"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </MyButton>
        )}
      </div>
    </div>
  );
};

export default QuestionSlide;
