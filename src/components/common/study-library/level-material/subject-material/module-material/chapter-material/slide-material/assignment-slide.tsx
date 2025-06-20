import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileUploader } from "./file-uploader";
import { useMutation } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { SUBMIT_ASSIGNMENT_SLIDE_ANSWERS } from "@/constants/urls";
import { v4 as uuidv4 } from "uuid";
import { getUserId } from "@/constants/getUserId";
import { MyInput } from "@/components/design-system/input";
import { Textarea } from "@/components/ui/textarea";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
// import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";

interface QuestionResponseMap {
  [key: string]: {
    value: string | string[];
    type: string;
  };
}

interface Option {
  id: string;
  text: {
    content: string;
  };
}

interface Question {
  id: string;
  text_data: {
    content: string;
  };
  question_type: string;
  options?: Option[];
  re_attempt_count: number;
  options_json?: string;
}

interface AssignmentSlideProps {
  assignmentData: {
    id: string;
    text_data?: {
      content: string;
    };
    parent_rich_text?: {
      content: string;
    };
    live_date: string;
    end_date: string;
    re_attempt_count: number;
    questions?: Question[];
  };
  onUpload: (
    file: File
  ) => Promise<{ success: boolean; fileId?: string; error?: string }>;
  isUploading: boolean;
}

const AssignmentSlide = ({
  assignmentData,
  onUpload,
  isUploading,
}: AssignmentSlideProps) => {
  const { activeItem } = useContentStore();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [questionResponses, setQuestionResponses] =
    useState<QuestionResponseMap>({});
  const [numericValuesMap, setNumericValuesMap] = useState<
    Record<string, string>
  >({});

  // Constants for numeric input
  const isDecimal = false;
  const maxDecimals = 2;

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    try {
      const result = await onUpload(file);
      if (result.success && result.fileId) {
        setUploadedFiles((prev) => [...prev, file]);
        setUploadedFileIds((prev) => [...prev, result.fileId!]);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error uploading file:", error);
      return false;
    }
  };

  // Handle question response change
  const handleResponseChange = (
    questionId: string,
    value: string | string[],
    type: string
  ) => {
    setQuestionResponses((prev) => ({
      ...prev,
      [questionId]: { value, type },
    }));
  };

  // Get question type display name
  const getQuestionTypeDisplay = (type: string) => {
    switch (type) {
      case "MCQS":
        return "Multiple Choice (Single Answer)";
      case "MCQM":
        return "Multiple Choice (Multiple Answers)";
      case "ONE_WORD":
        return "One Word Answer";
      case "LONG_ANSWER":
        return "Long Answer";
      case "NUMERIC":
        return "Numeric Answer";
      case "TRUE_FALSE":
        return "True/False";
      default:
        return type;
    }
  };

  // Handle numeric input changes
  const handleNumericChange = (questionId: string, value: string) => {
    if (isDecimal) {
      if (/^-?\d*\.?\d*$/.test(value)) {
        if (value.includes(".")) {
          const parts = value.split(".");
          if (parts[1].length <= maxDecimals) {
            setNumericValuesMap((prev) => ({
              ...prev,
              [questionId]: value,
            }));
          }
        } else {
          setNumericValuesMap((prev) => ({
            ...prev,
            [questionId]: value,
          }));
        }
      }
    } else {
      if (/^-?\d*$/.test(value)) {
        setNumericValuesMap((prev) => ({
          ...prev,
          [questionId]: value,
        }));
      }
    }
  };

  // Handle keypad button press for numeric input
  const handleKeyPress = (questionId: string, key: string) => {
    const currentValue = numericValuesMap[questionId] || "";
    if (key === "backspace") {
      setNumericValuesMap((prev) => ({
        ...prev,
        [questionId]: currentValue.slice(0, -1),
      }));
    } else if (key === "clear") {
      setNumericValuesMap((prev) => ({
        ...prev,
        [questionId]: "",
      }));
    } else if (key === "." && isDecimal && !currentValue.includes(".")) {
      setNumericValuesMap((prev) => ({
        ...prev,
        [questionId]: currentValue + ".",
      }));
    } else if (/[0-9]/.test(key)) {
      if (currentValue.includes(".")) {
        const parts = currentValue.split(".");
        if (parts[1].length < maxDecimals) {
          setNumericValuesMap((prev) => ({
            ...prev,
            [questionId]: currentValue + key,
          }));
        }
      } else {
        setNumericValuesMap((prev) => ({
          ...prev,
          [questionId]: currentValue + key,
        }));
      }
    }
  };

  // Submit assignment mutation
  const submitAssignmentMutation = useMutation({
    mutationFn: async () => {
      if (!activeItem) throw new Error("No active item");

      const payload = {
        id: uuidv4(),
        source_id: activeItem.source_id || "",
        source_type: activeItem.source_type || "",
        user_id: "current-user-id",
        slide_id: activeItem.id || "",
        start_time_in_millis: Date.now() - 60000,
        end_time_in_millis: Date.now(),
        percentage_watched: 100,
        videos: [],
        documents: [],
        question_slides: [],
        assignment_slides: [
          {
            id: assignmentData.id,
            comma_separated_file_ids: uploadedFileIds.join(","),
            date_submitted: new Date().toISOString(),
            marks: 0,
          },
        ],
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

      const urlParams = new URLSearchParams(window.location.search);
      const slideId = urlParams.get("slideId") || "";
      const userId = await getUserId();
      return authenticatedAxiosInstance.post(SUBMIT_ASSIGNMENT_SLIDE_ANSWERS, payload, {
        params: {
          slideId,
          userId,
        },
      });
    },
    onSuccess: () => {
      setSubmitSuccess(true);
      setSubmitError(null);
    },
    onError: (error: Error) => {
      setSubmitSuccess(false);
      setSubmitError(error.message || "Failed to submit assignment");
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Handle assignment submission
  const handleSubmit = async () => {
    setIsSubmitting(true);
    submitAssignmentMutation.mutate();
  };

  // Render question based on type
  const renderQuestion = (question: Question, index: number) => {
    if (!question.text_data?.content) return null;

    const currentResponse = questionResponses[question.id]?.value || "";

    return (
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-md font-medium">
            {index + 1}. {question.text_data.content}
          </h3>
          <div className="text-sm text-gray-500">
            <div>Type: {getQuestionTypeDisplay(question.question_type)}</div>
            <div>Attempts: {question.re_attempt_count || "Unlimited"}</div>
          </div>
        </div>

        {(() => {
          switch (question.question_type) {
            case "MCQS":
            case "TRUE_FALSE":
              return (
                <div className="space-y-4">
                  {question.options?.map((option, optIndex) => (
                    <div
                      key={option.id}
                      className={`flex flex-row-reverse items-center justify-between rounded-lg border p-4 w-full ${
                        typeof currentResponse === "string" &&
                        currentResponse === option.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200"
                      }`}
                      onClick={() =>
                        handleResponseChange(
                          question.id,
                          option.id,
                          question.question_type
                        )
                      }
                    >
                      <div className="relative flex items-center">
                        <div
                          className={`w-6 h-6 border rounded-md flex items-center justify-center ${
                            typeof currentResponse === "string" &&
                            currentResponse === option.id
                              ? "bg-green-500 border-green-500"
                              : "border-gray-300"
                          }`}
                        >
                          {typeof currentResponse === "string" &&
                            currentResponse === option.id && (
                              <span className="text-white font-bold">✔</span>
                            )}
                        </div>
                      </div>

                      <label
                        className={`flex-grow text-sm ${
                          typeof currentResponse === "string" &&
                          currentResponse === option.id
                            ? "font-semibold"
                            : "text-gray-700"
                        }`}
                      >
                        {question.question_type === "TRUE_FALSE"
                          ? option.text.content
                          : `${String.fromCharCode(65 + optIndex)}. ${
                              option.text.content
                            }`}
                      </label>
                    </div>
                  ))}
                </div>
              );

            case "MCQM":
              return (
                <div className="space-y-4">
                  {question.options?.map((option, optIndex) => (
                    <div
                      key={option.id}
                      className={`flex flex-row-reverse items-center justify-between rounded-lg border p-4 w-full ${
                        Array.isArray(currentResponse) &&
                        currentResponse.includes(option.id)
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200"
                      }`}
                      onClick={() => {
                        const currentValues = Array.isArray(currentResponse)
                          ? currentResponse
                          : [];
                        const newValues = currentValues.includes(option.id)
                          ? currentValues.filter((id) => id !== option.id)
                          : [...currentValues, option.id];
                        handleResponseChange(
                          question.id,
                          newValues,
                          question.question_type
                        );
                      }}
                    >
                      <div className="relative flex items-center">
                        <div
                          className={`w-6 h-6 border rounded-md flex items-center justify-center ${
                            Array.isArray(currentResponse) &&
                            currentResponse.includes(option.id)
                              ? "bg-green-500 border-green-500"
                              : "border-gray-300"
                          }`}
                        >
                          {Array.isArray(currentResponse) &&
                            currentResponse.includes(option.id) && (
                              <span className="text-white font-bold">✔</span>
                            )}
                        </div>
                      </div>

                      <label
                        className={`flex-grow text-sm ${
                          Array.isArray(currentResponse) &&
                          currentResponse.includes(option.id)
                            ? "font-semibold"
                            : "text-gray-700"
                        }`}
                      >
                        {String.fromCharCode(65 + optIndex)}.{" "}
                        {option.text.content}
                      </label>
                    </div>
                  ))}
                </div>
              );

            case "ONE_WORD":
              return (
                <div className="w-full max-w-md">
                  <MyInput
                    inputType="text"
                    input={
                      typeof currentResponse === "string" ? currentResponse : ""
                    }
                    onChangeFunction={(e) =>
                      handleResponseChange(
                        question.id,
                        e.target.value,
                        question.question_type
                      )
                    }
                    inputPlaceholder="Type your one-word answer"
                    className="text-xl py-4 font-medium w-full"
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                  />
                </div>
              );

            case "LONG_ANSWER":
              return (
                <div className="w-full">
                  <Textarea
                    value={
                      typeof currentResponse === "string" ? currentResponse : ""
                    }
                    onChange={(e) =>
                      handleResponseChange(
                        question.id,
                        e.target.value,
                        question.question_type
                      )
                    }
                    placeholder="Type your answer..."
                    className="min-h-[200px] text-base"
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                  />
                </div>
              );

            case "NUMERIC":
              return (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <MyInput
                      inputType="text"
                      input={numericValuesMap[question.id] || ""}
                      onChangeFunction={(e) =>
                        handleNumericChange(question.id, e.target.value)
                      }
                      inputPlaceholder={
                        isDecimal
                          ? "Enter decimal value"
                          : "Enter integer value"
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
                            onClick={() =>
                              handleKeyPress(question.id, num.toString())
                            }
                          >
                            {num}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          className="h-14 text-xl font-medium"
                          onClick={() => handleKeyPress(question.id, "0")}
                        >
                          0
                        </Button>
                        {isDecimal && (
                          <Button
                            variant="outline"
                            className="h-14 text-xl font-medium"
                            onClick={() => handleKeyPress(question.id, ".")}
                            disabled={numericValuesMap[question.id]?.includes(
                              "."
                            )}
                          >
                            .
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="h-14 text-xl font-medium"
                          onClick={() =>
                            handleKeyPress(question.id, "backspace")
                          }
                        >
                          ←
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Button
                          variant="outline"
                          className="h-14"
                          onClick={() => handleKeyPress(question.id, "clear")}
                        >
                          Clear
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );

            default:
              return (
                <p className="text-sm text-gray-500">
                  Question type not supported: {question.question_type}
                </p>
              );
          }
        })()}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <Card className="mb-4 sm:mb-6 bg-white shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg sm:text-xl font-medium text-gray-900">
            {assignmentData.text_data?.content || activeItem?.title}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-gray-600">
            <div className="flex flex-col space-y-1 mt-2">
              <span>
                <strong className="font-medium">Start Date:</strong>{" "}
                {formatDate(assignmentData.live_date)}
              </span>
              <span>
                <strong className="font-medium">Due Date:</strong>{" "}
                {formatDate(assignmentData.end_date)}
              </span>
              <span>
                <strong className="font-medium">Attempts Allowed:</strong>{" "}
                {assignmentData.re_attempt_count || "Unlimited"}
              </span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentData.parent_rich_text?.content && (
            <div className="prose max-w-none text-gray-700 text-sm sm:text-base">
              <div
                dangerouslySetInnerHTML={{
                  __html: assignmentData.parent_rich_text.content,
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Questions Section */}
      {assignmentData.questions && assignmentData.questions.length > 0 && (
        <Card className="mb-4 sm:mb-6 bg-white shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg sm:text-xl font-medium text-gray-900">
              Questions
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-600">
              Please answer all questions below
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignmentData.questions
              .filter((q: Question) => q.text_data?.content)
              .map((question: Question, index: number) => (
                <div
                  key={question.id}
                  className="mb-6 pb-6 border-b border-gray-200 last:border-0 last:mb-0 last:pb-0"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900">
                      {index + 1}. {question.text_data.content}
                    </h3>
                    <div className="text-xs sm:text-sm text-gray-500 sm:text-right">
                      <div>
                        Type: {getQuestionTypeDisplay(question.question_type)}
                      </div>
                      <div>
                        Attempts: {question.re_attempt_count || "Unlimited"}
                      </div>
                    </div>
                  </div>
                  {renderQuestion(question, index)}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* File Upload Section */}
      <Card className="mb-4 sm:mb-6 bg-white shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg sm:text-xl font-medium text-gray-900">
            Upload Files
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-gray-600">
            Upload any required files for this assignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploader
            onUpload={handleFileUpload}
            isUploading={isUploading}
            uploadedFiles={uploadedFiles}
            onRemove={(index) => {
              setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
              setUploadedFileIds((prev) => prev.filter((_, i) => i !== index));
            }}
          />
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isUploading}
          className={`px-6 py-2.5 rounded-md text-sm sm:text-base font-medium transition-colors ${
            isSubmitting || isUploading
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {isSubmitting ? "Submitting..." : "Submit Assignment"}
        </button>
      </div>

      {/* Success/Error Messages */}
      {submitSuccess && (
        <div className="mt-4 p-3 sm:p-4 bg-gray-50 text-gray-800 rounded-md text-sm sm:text-base border border-gray-200">
          Assignment submitted successfully!
        </div>
      )}
      {submitError && (
        <div className="mt-4 p-3 sm:p-4 bg-gray-50 text-gray-800 rounded-md text-sm sm:text-base border border-gray-200">
          Error: {submitError}
        </div>
      )}
    </div>
  );
};

export default AssignmentSlide;
