"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { MyInput } from "@/components/design-system/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
// import { MyButton } from "@/components/design-system/button";
import { useMutation } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { SUBMIT_SLIDE_ANSWERS } from "@/constants/urls";
import { v4 as uuidv4 } from "uuid";
import { getUserId } from "@/constants/getUserId";
import { Textarea } from "@/components/ui/textarea";

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
  ) => Promise<{
    success: boolean;
    isCorrect?: boolean;
    correctOption?: string;
    explanation?: string;
    error?: string;
  }>;
}

interface QuestionResponseMap {
  [key: string]: {
    value: string | string[];
    type: string;
  };
}

const QuestionSlide = ({ questionData, onSubmit }: QuestionSlideProps) => {
  // const { activeItem } = useContentStore();
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<
    Record<string, string | null>
  >({});
  const [selectedMultiOptionsMap, setSelectedMultiOptionsMap] = useState<
    Record<string, string[]>
  >({});
  const [inputValuesMap, setInputValuesMap] = useState<Record<string, string>>(
    {}
  );
  const [numericValuesMap, setNumericValuesMap] = useState<
    Record<string, string>
  >({});
  const [isSubmittingMap, setIsSubmittingMap] = useState<
    Record<string, boolean>
  >({});
  const [isDecimal, setIsDecimal] = useState(false);
  const [maxDecimals, setMaxDecimals] = useState(0);
  // const [questionResponses, setQuestionResponses] =
  useState<QuestionResponseMap>({});

  const maxAttempts = questionData?.re_attempt_count || 1;
  const questionType = questionData?.question_type || "MCQS";

  // Get slideId from URL
  const urlParams = new URLSearchParams(window.location.search);
  const slideId = urlParams.get("slideId") || "unknown";
  const isSubmitting = isSubmittingMap[slideId] || false;

  // Get current slide's values
  const selectedOption = selectedOptionsMap[slideId] || null;
  const selectedOptions = selectedMultiOptionsMap[slideId] || [];
  const inputValue = inputValuesMap[slideId] || "";
  const numericValue = numericValuesMap[slideId] || "";

  // Submit question mutation
  const submitQuestionMutation = useMutation({
    mutationFn: async (selectedAnswer: string | string[]) => {
      const userId = await getUserId();

      if (!slideId || !userId) {
        throw new Error("Missing slideId or userId in URL");
      }

      const payload = {
        id: uuidv4(),
        source_id: slideId,
        source_type: "QUESTION",
        user_id: userId,
        slide_id: slideId,
        start_time_in_millis: Date.now() - 60000,
        end_time_in_millis: Date.now(),
        percentage_watched: 100,
        videos: [],
        documents: [],
        question_slides: [
          {
            id: slideId,
            attempt_number: maxAttempts,
            response_json: JSON.stringify({
              selectedOption: selectedAnswer,
            }),
            response_status: "SUBMITTED",
            marks: 0,
          },
        ],
        assignment_slides: [],
        video_slides_questions: [],
        new_activity: true,
        concentration_score: {
          id: uuidv4(),
          concentration_score: 100,
          tab_switch_count: 0,
          pause_count: 0,
          answer_times_in_seconds: [],
        },
      };

      return authenticatedAxiosInstance.post(SUBMIT_SLIDE_ANSWERS, payload, {
        params: {
          slideId,
          userId,
        },
      });
    },
    onSuccess: () => {
      console.log("Question answer submitted successfully");
    },
    onError: (error: Error) => {
      console.error("Error submitting question answer:", error);
    },
  });

  // Parse auto evaluation JSON to find correct answer
  useEffect(() => {
    try {
      if (questionData?.auto_evaluation_json) {
        const evaluationData = JSON.parse(questionData.auto_evaluation_json);

        if (questionType === "MCQS" || questionType === "TRUE_FALSE") {
          // For multiple choice questions and true/false
          if (evaluationData.data?.correctOptionIds) {
            const correctId = evaluationData.data.correctOptionIds[0];
            setSelectedOptionsMap((prev) => ({
              ...prev,
              [slideId]: correctId,
            }));
          } else {
            // If not specified, assume first option is correct (for demo)
            setSelectedOptionsMap((prev) => ({
              ...prev,
              [slideId]: questionData.options[0]?.id,
            }));
          }
        } else if (questionType === "MCQM") {
          // For multiple select questions
          if (evaluationData.data?.correctOptionIds) {
            setSelectedMultiOptionsMap((prev) => ({
              ...prev,
              [slideId]: evaluationData.data.correctOptionIds,
            }));
          }
        } else if (questionType === "ONE_WORD" || questionType === "NUMERIC") {
          // For one-word or numeric questions
          if (evaluationData.data?.correctAnswer) {
            setInputValuesMap((prev) => ({
              ...prev,
              [slideId]: evaluationData.data.correctAnswer,
            }));
          }
        }
      } else if (questionType === "MCQS" || questionType === "TRUE_FALSE") {
        // Default to first option if no evaluation data
        setSelectedOptionsMap((prev) => ({
          ...prev,
          [slideId]: questionData.options[0]?.id,
        }));
      }

      // Parse options_json for numeric type questions
      if (questionType === "NUMERIC" && questionData.options_json) {
        const options = JSON.parse(questionData.options_json);
        setIsDecimal(options.numeric_type === "DECIMAL");
        setMaxDecimals(options.decimals || 0);
      }
    } catch (error) {
      console.error("Error parsing JSON data:", error);
      if (questionType === "MCQS" || questionType === "TRUE_FALSE") {
        setSelectedOptionsMap((prev) => ({
          ...prev,
          [slideId]: questionData.options[0]?.id,
        }));
      }
    }
  }, [questionData, questionType]);

  const handleOptionSelect = (optionId: string) => {
    if (isSubmitting) return;

    if (questionType === "MCQS" || questionType === "TRUE_FALSE") {
      setSelectedOptionsMap((prev) => ({
        ...prev,
        [slideId]: optionId,
      }));
    } else if (questionType === "MCQM") {
      setSelectedMultiOptionsMap((prev) => {
        const currentOptions = prev[slideId] || [];
        const newOptions = currentOptions.includes(optionId)
          ? currentOptions.filter((id) => id !== optionId)
          : [...currentOptions, optionId];
        return {
          ...prev,
          [slideId]: newOptions,
        };
      });
    }
  };

  // Update handleInputChange to handle both input and textarea events
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setInputValuesMap((prev) => ({
      ...prev,
      [slideId]: e.target.value,
    }));
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
            setNumericValuesMap((prev) => ({
              ...prev,
              [slideId]: value,
            }));
          }
        } else {
          setNumericValuesMap((prev) => ({
            ...prev,
            [slideId]: value,
          }));
        }
      }
    } else {
      // Integer only
      if (/^-?\d*$/.test(value)) {
        setNumericValuesMap((prev) => ({
          ...prev,
          [slideId]: value,
        }));
      }
    }
  };

  // Handle keypad button press for numeric input
  const handleKeyPress = (key: string) => {
    if (key === "backspace") {
      setNumericValuesMap((prev) => ({
        ...prev,
        [slideId]: (prev[slideId] || "").slice(0, -1),
      }));
    } else if (key === "clear") {
      setNumericValuesMap((prev) => ({
        ...prev,
        [slideId]: "",
      }));
    } else if (key === "." && isDecimal && !numericValue.includes(".")) {
      setNumericValuesMap((prev) => ({
        ...prev,
        [slideId]: (prev[slideId] || "") + ".",
      }));
    } else if (/[0-9]/.test(key)) {
      setNumericValuesMap((prev) => {
        const currentValue = prev[slideId] || "";
        // If there's a decimal point, check we don't exceed max decimal places
        if (currentValue.includes(".")) {
          const parts = currentValue.split(".");
          if (parts[1].length >= maxDecimals) {
            return prev;
          }
        }
        return {
          ...prev,
          [slideId]: currentValue + key,
        };
      });
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Check if we have a valid answer to submit
    if (
      ((questionType === "MCQS" || questionType === "TRUE_FALSE") &&
        !selectedOption) ||
      (questionType === "MCQM" && selectedOptions.length === 0) ||
      ((questionType === "ONE_WORD" || questionType === "LONG_ANSWER") &&
        !inputValue.trim()) ||
      (questionType === "NUMERIC" && !numericValue.trim())
    ) {
      return;
    }

    setIsSubmittingMap((prev) => ({
      ...prev,
      [slideId]: true,
    }));

    try {
      let submissionValue: string | string[];

      // Prepare submission value based on question type
      if (questionType === "MCQS" || questionType === "TRUE_FALSE") {
        submissionValue = selectedOption || "";
      } else if (questionType === "MCQM") {
        submissionValue = selectedOptions;
      } else if (
        questionType === "ONE_WORD" ||
        questionType === "LONG_ANSWER"
      ) {
        submissionValue = inputValue.trim();
      } else if (questionType === "NUMERIC") {
        submissionValue = numericValue.trim();
      } else {
        submissionValue = "";
      }

      // Submit to API
      await submitQuestionMutation.mutateAsync(submissionValue);

      // Call the onSubmit function passed from parent
      await onSubmit(slideId, submissionValue);

      // Reset inputs after submission
      if (questionType === "MCQS" || questionType === "TRUE_FALSE") {
        setSelectedOptionsMap((prev) => ({
          ...prev,
          [slideId]: null,
        }));
      } else if (questionType === "MCQM") {
        setSelectedMultiOptionsMap((prev) => ({
          ...prev,
          [slideId]: [],
        }));
      } else if (
        questionType === "ONE_WORD" ||
        questionType === "LONG_ANSWER"
      ) {
        setInputValuesMap((prev) => ({
          ...prev,
          [slideId]: "",
        }));
      } else if (questionType === "NUMERIC") {
        setNumericValuesMap((prev) => ({
          ...prev,
          [slideId]: "",
        }));
      }
    } catch (error) {
      console.error("Error in submission:", error);
    } finally {
      setIsSubmittingMap((prev) => ({
        ...prev,
        [slideId]: false,
      }));
    }
  };

  // Render the appropriate question component based on question type
  const renderQuestionContent = () => {
    switch (questionType) {
      case "MCQS":
      case "TRUE_FALSE":
        return (
          <div className="space-y-2 sm:space-y-3">
            {questionData?.options?.map((option, index) => (
              <div
                key={option.id}
                onClick={() => handleOptionSelect(option.id)}
                className={`flex flex-row-reverse items-center justify-between rounded-md border p-3 w-full transition-all duration-200 hover:border-gray-400 ${
                  selectedOption === option.id
                    ? "border-gray-600 bg-gray-50"
                    : "border-gray-200"
                }`}
              >
                <div className="relative flex items-center">
                  <div
                    className={`w-5 h-5 border rounded-md flex items-center justify-center transition-colors ${
                      selectedOption === option.id
                        ? "bg-gray-800 border-gray-800"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedOption === option.id && (
                      <span className="text-white text-sm">✓</span>
                    )}
                  </div>
                </div>

                <label
                  className={`flex-grow text-sm sm:text-base ${
                    selectedOption === option.id
                      ? "font-medium text-gray-900"
                      : "text-gray-700"
                  }`}
                >
                  {questionType === "TRUE_FALSE"
                    ? option.text.content
                    : `${String.fromCharCode(97 + index)}. ${option.text.content}`}
                </label>
              </div>
            ))}
          </div>
        );

      case "MCQM":
        return (
          <div className="space-y-2 sm:space-y-3">
            {questionData?.options?.map((option, index) => (
              <div
                key={option.id}
                onClick={() => handleOptionSelect(option.id)}
                className={`flex flex-row-reverse items-center justify-between rounded-md border p-3 w-full transition-all duration-200 hover:border-gray-400 ${
                  selectedOptions.includes(option.id)
                    ? "border-gray-600 bg-gray-50"
                    : "border-gray-200"
                }`}
              >
                <div className="relative flex items-center">
                  <div
                    className={`w-5 h-5 border rounded-md flex items-center justify-center transition-colors ${
                      selectedOptions.includes(option.id)
                        ? "bg-gray-800 border-gray-800"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedOptions.includes(option.id) && (
                      <span className="text-white text-sm">✓</span>
                    )}
                  </div>
                </div>

                <label
                  className={`flex-grow text-sm sm:text-base ${
                    selectedOptions.includes(option.id)
                      ? "font-medium text-gray-900"
                      : "text-gray-700"
                  }`}
                >
                  {`${String.fromCharCode(97 + index)}. ${option.text.content}`}
                </label>
              </div>
            ))}
          </div>
        );

      case "ONE_WORD":
        return (
          <div className="w-full max-w-md mx-auto mt-2 sm:mt-4">
            <MyInput
              inputType="text"
              input={inputValue}
              onChangeFunction={handleInputChange}
              inputPlaceholder="Type your one-word answer"
              className="text-base sm:text-lg py-3 font-normal w-full border-gray-300 focus:border-gray-600 focus:ring-gray-600"
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
            />
          </div>
        );

      case "LONG_ANSWER":
        return (
          <div className="w-full max-w-2xl mx-auto mt-2 sm:mt-4">
            <Textarea
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Type your answer..."
              className="min-h-[150px] sm:min-h-[200px] text-base border-gray-300 focus:border-gray-600 focus:ring-gray-600"
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
            />
          </div>
        );

      case "NUMERIC":
        return (
          <div className="space-y-3 sm:space-y-4 mt-4">
            <div className="flex justify-center">
              <MyInput
                inputType="text"
                input={numericValue}
                onChangeFunction={handleNumericChange}
                inputPlaceholder={
                  isDecimal ? "Enter decimal value" : "Enter integer value"
                }
                inputMode="numeric"
                className="text-base sm:text-lg py-3 font-normal w-full max-w-md border-gray-300 focus:border-gray-600 focus:ring-gray-600"
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
              />
            </div>

            <Card className="max-w-md mx-auto bg-white shadow-sm">
              <CardContent className="p-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                    <Button
                      key={num}
                      variant="outline"
                      className="h-12 text-base font-normal hover:bg-gray-100 border-gray-200"
                      onClick={() => handleKeyPress(num.toString())}
                    >
                      {num}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    className="h-12 text-base font-normal hover:bg-gray-100 border-gray-200"
                    onClick={() => handleKeyPress("0")}
                  >
                    0
                  </Button>
                  {isDecimal && (
                    <Button
                      variant="outline"
                      className="h-12 text-base font-normal hover:bg-gray-100 border-gray-200"
                      onClick={() => handleKeyPress(".")}
                      disabled={numericValue.includes(".")}
                    >
                      .
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="h-12 text-base font-normal hover:bg-gray-100 border-gray-200"
                    onClick={() => handleKeyPress("backspace")}
                  >
                    ←
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  <Button
                    variant="outline"
                    className="h-12 text-base font-normal hover:bg-gray-100 border-gray-200"
                    onClick={() => handleKeyPress("clear")}
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return <p>Unsupported question type: {questionType}</p>;
    }
  };

  // Update the isSubmitDisabled logic
  const isSubmitDisabled =
    isSubmitting ||
    ((questionType === "MCQS" || questionType === "TRUE_FALSE") &&
      !selectedOption) ||
    (questionType === "MCQM" && selectedOptions.length === 0) ||
    ((questionType === "ONE_WORD" || questionType === "LONG_ANSWER") &&
      !inputValue.trim()) ||
    (questionType === "NUMERIC" && !numericValue.trim());

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-4 sm:p-6">
      <h2
        className="text-lg sm:text-xl font-medium text-gray-900 mb-3 sm:mb-4"
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

      <div className="mt-4 sm:mt-6">
        <h3 className="text-base sm:text-lg font-medium text-gray-700 mb-2 sm:mb-3">
          {questionType === "MCQS"
            ? "Select one answer:"
            : questionType === "TRUE_FALSE"
              ? "Select True or False:"
              : questionType === "MCQM"
                ? "Select all that apply:"
                : questionType === "ONE_WORD"
                  ? "Enter your answer:"
                  : questionType === "LONG_ANSWER"
                    ? "Type your answer:"
                    : "Enter numeric value:"}
        </h3>

        {renderQuestionContent()}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          className={`px-6 py-2.5 rounded-md text-sm sm:text-base font-medium transition-colors ${
            isSubmitDisabled
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
};

export default QuestionSlide;