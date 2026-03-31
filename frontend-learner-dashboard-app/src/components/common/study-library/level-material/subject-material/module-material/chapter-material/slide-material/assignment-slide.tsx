import { useState, useEffect, useRef } from "react";
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
import "katex/dist/katex.min.css";
import katex from "katex";

/** Returns an SVG icon string based on file extension / MIME type */
const getFileIconSvg = (fileName: string, mimeType: string): string => {
  const name = fileName.toLowerCase();
  const type = mimeType.toLowerCase();

  // PDF
  if (type.includes("pdf") || name.endsWith(".pdf")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12l-2 4h4l-2 4"/></svg>`;
  }
  // Images
  if (type.includes("image") || /\.(jpg|jpeg|png|gif|svg|webp|bmp)$/i.test(name)) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  }
  // Word docs
  if (/\.(doc|docx)$/i.test(name) || type.includes("word")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  }
  // Spreadsheets
  if (/\.(xls|xlsx|csv)$/i.test(name) || type.includes("sheet") || type.includes("excel")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><rect x="8" y="12" width="8" height="6" rx="1"/></svg>`;
  }
  // Video
  if (type.includes("video") || /\.(mp4|mov|avi|webm|mkv)$/i.test(name)) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
  }
  // Audio
  if (type.includes("audio") || /\.(mp3|wav|ogg|aac|flac)$/i.test(name)) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
  }
  // Archive
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>`;
  }
  // Generic file
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
};

/** Download arrow icon */
const downloadIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

/** Get human-readable file size label from extension */
const getFileTypeLabel = (fileName: string, mimeType: string): string => {
  const name = fileName.toLowerCase();
  const type = mimeType.toLowerCase();
  if (type.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (/\.(jpg|jpeg)$/i.test(name) || type.includes("jpeg")) return "JPEG";
  if (name.endsWith(".png") || type.includes("png")) return "PNG";
  if (/\.(doc|docx)$/i.test(name) || type.includes("word")) return "Word";
  if (/\.(xls|xlsx)$/i.test(name) || type.includes("sheet")) return "Excel";
  if (/\.(ppt|pptx)$/i.test(name) || type.includes("presentation")) return "PPT";
  if (name.endsWith(".csv")) return "CSV";
  if (/\.(mp4|mov|avi|webm)$/i.test(name) || type.includes("video")) return "Video";
  if (/\.(mp3|wav|ogg)$/i.test(name) || type.includes("audio")) return "Audio";
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return "Archive";
  return "File";
};

/** Renders HTML content with KaTeX math support and enhanced attachment rendering */
const HtmlWithKatex = ({ html, className = "" }: { html: string; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Re-render math-inline/math-display spans with data-latex attributes
    const mathSpans = ref.current.querySelectorAll(
      "span.math-inline[data-latex], span.math-display[data-latex], div.math-display[data-latex], span[data-latex], div[data-latex]"
    );
    mathSpans.forEach((span) => {
      const latex = span.getAttribute("data-latex");
      if (!latex) return;
      const isDisplay = span.classList.contains("math-display");
      try {
        katex.render(latex, span as HTMLElement, {
          throwOnError: false,
          displayMode: isDisplay,
        });
      } catch {
        // Keep original content on failure
      }
    });

    // Enhance attachment links with file icons and better styling
    const attachmentLinks = ref.current.querySelectorAll('a[data-attachment="true"]');
    attachmentLinks.forEach((link) => {
      if (link.getAttribute("data-enhanced")) return;
      link.setAttribute("data-enhanced", "true");

      const anchor = link as HTMLAnchorElement;
      const fileName = anchor.getAttribute("name") || anchor.textContent?.trim() || "File";
      const mimeType = anchor.getAttribute("type") || "";
      const typeLabel = getFileTypeLabel(fileName, mimeType);
      const iconSvg = getFileIconSvg(fileName, mimeType);

      // Replace inline styles with a clean card-like look
      anchor.removeAttribute("style");
      anchor.style.cssText = `
        display: flex; align-items: center; gap: 12px;
        background: #f9fafb; padding: 12px 16px; border-radius: 10px;
        border: 1px solid #e5e7eb; text-decoration: none; color: #111827;
        transition: all 0.15s ease; cursor: pointer; max-width: 400px;
      `;

      // Build enhanced inner HTML
      anchor.innerHTML = `
        <span style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; background: #f3f4f6; flex-shrink: 0;">
          ${iconSvg}
        </span>
        <span style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;">
          <span style="font-size: 14px; font-weight: 500; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${fileName}
          </span>
          <span style="font-size: 12px; color: #6b7280;">
            ${typeLabel}
          </span>
        </span>
        <span style="flex-shrink: 0; display: flex; align-items: center;">
          ${downloadIconSvg}
        </span>
      `;

      // Hover effect
      anchor.addEventListener("mouseenter", () => {
        anchor.style.background = "#f3f4f6";
        anchor.style.borderColor = "#d1d5db";
      });
      anchor.addEventListener("mouseleave", () => {
        anchor.style.background = "#f9fafb";
        anchor.style.borderColor = "#e5e7eb";
      });
    });
  }, [html]);

  return (
    <div
      ref={ref}
      className={className}
      dangerouslySetInnerHTML={{ __html: html || "" }}
    />
  );
};

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
  question_type?: string;
  question_order?: number;
  options?: Option[];
  re_attempt_count?: number;
  options_json?: string;
  status?: string;
  new_question?: boolean;
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
      return authenticatedAxiosInstance.post(
        SUBMIT_ASSIGNMENT_SLIDE_ANSWERS,
        payload,
        {
          params: {
            slideId,
            userId,
          },
        }
      );
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

  // Render MCQ options (shared for MCQS, MCQM, TRUE_FALSE)
  const renderOptions = (question: Question, isMultiSelect: boolean) => {
    const currentResponse = questionResponses[question.id]?.value || "";
    const qType = question.question_type || "";

    if (!question.options?.length) return null;

    return (
      <div className="space-y-4">
        {question.options.map((option, optIndex) => {
          const isSelected = isMultiSelect
            ? Array.isArray(currentResponse) && currentResponse.includes(option.id)
            : typeof currentResponse === "string" && currentResponse === option.id;

          return (
            <div
              key={option.id}
              className={`flex flex-row-reverse items-center justify-between rounded-lg border p-4 w-full cursor-pointer ${
                isSelected ? "border-primary-500 bg-primary-50" : "border-gray-200"
              }`}
              onClick={() => {
                if (isMultiSelect) {
                  const currentValues = Array.isArray(currentResponse) ? currentResponse : [];
                  const newValues = currentValues.includes(option.id)
                    ? currentValues.filter((id) => id !== option.id)
                    : [...currentValues, option.id];
                  handleResponseChange(question.id, newValues, qType);
                } else {
                  handleResponseChange(question.id, option.id, qType);
                }
              }}
            >
              <div className="relative flex items-center">
                <div
                  className={`w-6 h-6 border rounded-md flex items-center justify-center ${
                    isSelected ? "bg-green-500 border-green-500" : "border-gray-300"
                  }`}
                >
                  {isSelected && <span className="text-white font-bold">✔</span>}
                </div>
              </div>
              <label className={`flex-grow text-sm ${isSelected ? "font-semibold" : "text-gray-700"}`}>
                {qType === "TRUE_FALSE" ? (
                  <HtmlWithKatex html={option.text.content} className="inline" />
                ) : (
                  <>
                    {String.fromCharCode(65 + optIndex)}.{" "}
                    <HtmlWithKatex html={option.text.content} className="inline" />
                  </>
                )}
              </label>
            </div>
          );
        })}
      </div>
    );
  };

  // Render question based on type
  const renderQuestion = (question: Question, index: number) => {
    if (!question.text_data?.content) return null;

    const currentResponse = questionResponses[question.id]?.value || "";
    const qType = question.question_type || "";

    return (
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-md font-medium flex gap-1">
            <span className="min-w-fit">{index + 1}.</span>
            <HtmlWithKatex html={question.text_data.content} />
          </h3>
          {qType && (
            <div className="text-sm text-gray-500 min-w-fit ml-4">
              <div>Type: {getQuestionTypeDisplay(qType)}</div>
              {question.re_attempt_count != null && (
                <div>Attempts: {question.re_attempt_count || "Unlimited"}</div>
              )}
            </div>
          )}
        </div>

        {(() => {
          switch (qType) {
            case "MCQS":
              return renderOptions(question, false);

            case "TRUE_FALSE":
              return renderOptions(question, false);

            case "MCQM":
              return renderOptions(question, true);

            case "ONE_WORD":
              return (
                <div className="w-full max-w-md">
                  <MyInput
                    inputType="text"
                    input={typeof currentResponse === "string" ? currentResponse : ""}
                    onChangeFunction={(e) =>
                      handleResponseChange(question.id, e.target.value, qType)
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
                    value={typeof currentResponse === "string" ? currentResponse : ""}
                    onChange={(e) =>
                      handleResponseChange(question.id, e.target.value, qType)
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
                            onClick={() => handleKeyPress(question.id, num.toString())}
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
                            disabled={numericValuesMap[question.id]?.includes(".")}
                          >
                            .
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="h-14 text-xl font-medium"
                          onClick={() => handleKeyPress(question.id, "backspace")}
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
              // No question_type — display as read-only text question
              // (student answers via file upload)
              return null;
          }
        })()}
      </div>
    );
  };

  return (
    <div className="w-full max-w-none mx-auto px-2 sm:px-4">
      <Card className="mb-4 sm:mb-6 bg-white shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg sm:text-xl font-medium text-gray-900">
            <HtmlWithKatex html={assignmentData.text_data?.content || activeItem?.title || ""} />
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
            <HtmlWithKatex
              html={assignmentData.parent_rich_text.content}
              className="prose max-w-none text-gray-700 text-sm sm:text-base"
            />
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
