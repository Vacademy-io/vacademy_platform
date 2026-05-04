import { parseHtmlToString } from "@/lib/utils";

interface QuestionOption {
  id: string;
  text: {
    content: string;
  };
}

export interface SectionQuestions {
  [key: string]: Array<{
    question_id: string;
    options: QuestionOption[];
    options_with_explanation: QuestionOption[];
  }>;
}

// Function to find option name by ID from questions data
const findOptionName = (
  optionId: string,
  questionsData: SectionQuestions | null,
  questionId: string
) => {
  if (!questionsData) return optionId;

  for (const sectionQuestions of Object.values(questionsData)) {
    const question = sectionQuestions.find((q) => q.question_id === questionId);
    if (question) {
      // Check in both options and options_with_explanation
      const option = [
        ...(question.options || []),
        ...(question.options_with_explanation || []),
      ].find((opt) => opt.id === optionId);

      if (option?.text?.content) {
        return parseHtmlToString(option.text.content);
      }
    }
  }
  return optionId;
};

interface ReviewOption {
  option_name: string;
}

interface Review {
  student_response_options: string | ReviewOption[];
  question_type: string;
  question_id: string;
  correct_options: string | ReviewOption[];
}

// Function to render student response based on question type
export const renderStudentResponse = (
  review: Review,
  questionsData: SectionQuestions | null = null
) => {
  if (!review.student_response_options) return <p>No response</p>;

  try {
    // Handle both string and object formats
    const responseData =
      typeof review.student_response_options === "string"
        ? JSON.parse(review.student_response_options)
        : review.student_response_options;

    // If it's an array, it's in the legacy format with direct option names
    if (Array.isArray(review.student_response_options)) {
      return review.student_response_options.map(
        (option: ReviewOption, idx: number) => (
          <p key={idx}>{parseHtmlToString(option.option_name)}</p>
        )
      );
    }

    switch (review.question_type) {
      case "ONE_WORD":
        return <p>{responseData.responseData?.answer || "No response"}</p>;

      case "LONG_ANSWER":
        return <p>{responseData.responseData?.answer || "No response"}</p>;

      case "NUMERIC":
        return (
          <p>
            {responseData.responseData?.validAnswer?.toString() ||
              "No response"}
          </p>
        );

      case "MCQS":
      case "TRUE_FALSE":
        if (responseData.responseData?.optionIds?.length) {
          const optionId = responseData.responseData.optionIds[0]; // MCQS has single selection
          const optionName = findOptionName(
            optionId,
            questionsData,
            review.question_id
          );
          return <p>{optionName}</p>;
        }
        return <p>No option selected</p>;

      case "MCQM":
        if (responseData.responseData?.optionIds?.length) {
          return (
            <div>
              {responseData.responseData.optionIds.map((optionId: string) => {
                const optionName = findOptionName(
                  optionId,
                  questionsData,
                  review.question_id
                );
                return <p key={optionId}>{optionName}</p>;
              })}
            </div>
          );
        }
        return <p>No options selected</p>;

      case "CODING": {
        const r = responseData.responseData || {};
        const tests = (r.testCaseResults || []) as Array<{
          id?: string;
          label?: string;
          passed?: boolean;
          visible?: boolean;
        }>;
        const passed = tests.filter((t) => t.passed).length;
        const total = tests.length;
        const verdictColor =
          r.verdict === "ACCEPTED"
            ? "text-green-700"
            : r.verdict === "PARTIAL"
              ? "text-yellow-700"
              : "text-red-700";

        // Pull allowed limits from the question's correct_options JSON
        // (data.perRunLimits.{cpuSeconds, memoryKb}). Render alongside the
        // measured totalTimeMs / peakMemoryKb from the submission.
        let allowedTimeMs: number | null = null;
        let allowedMemoryKb: number | null = null;
        try {
          const correct =
            typeof review.correct_options === "string"
              ? JSON.parse(review.correct_options)
              : review.correct_options;
          const limits = correct?.data?.perRunLimits;
          if (limits) {
            if (typeof limits.cpuSeconds === "number") {
              allowedTimeMs = limits.cpuSeconds * 1000;
            }
            if (typeof limits.memoryKb === "number") {
              allowedMemoryKb = limits.memoryKb;
            }
          }
        } catch {
          // correct_options not parseable — show measured values only.
        }

        const measuredTimeMs =
          typeof r.totalTimeMs === "number" ? r.totalTimeMs : null;
        const measuredMemoryKb =
          typeof r.peakMemoryKb === "number" ? r.peakMemoryKb : null;
        const showRuntimeRow =
          measuredTimeMs !== null ||
          measuredMemoryKb !== null ||
          allowedTimeMs !== null ||
          allowedMemoryKb !== null;
        return (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-medium ${verdictColor}`}>
                {r.verdict || "—"}
              </span>
              <span className="text-muted-foreground">
                {passed}/{total} tests
              </span>
              {typeof r.score === "number" && (
                <span className="text-muted-foreground">
                  · {r.score.toFixed(2)} pts
                </span>
              )}
              {r.language && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {r.language}
                </span>
              )}
              {(r.pasteAttemptCount ?? 0) > 0 && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                  {r.pasteAttemptCount} paste attempt(s)
                </span>
              )}
            </div>
            {showRuntimeRow && (
              <div className="flex flex-wrap gap-3 text-xs">
                <span>
                  <b>Time taken:</b>{" "}
                  <code className="rounded bg-muted px-1">
                    {measuredTimeMs !== null ? `${measuredTimeMs} ms` : "—"}
                  </code>
                  {allowedTimeMs !== null && (
                    <span className="text-muted-foreground">
                      {" "}
                      / {allowedTimeMs} ms allowed
                    </span>
                  )}
                </span>
                <span>
                  <b>Memory:</b>{" "}
                  <code className="rounded bg-muted px-1">
                    {measuredMemoryKb !== null
                      ? `${measuredMemoryKb} KB`
                      : "—"}
                  </code>
                  {allowedMemoryKb !== null && (
                    <span className="text-muted-foreground">
                      {" "}
                      / {allowedMemoryKb} KB allowed
                    </span>
                  )}
                </span>
              </div>
            )}
            {r.sourceCode && (
              <details>
                <summary className="cursor-pointer text-xs">
                  Show submitted source code
                </summary>
                <pre className="mt-1 max-h-64 overflow-auto rounded bg-gray-100 p-2 text-xs">
                  {r.sourceCode}
                </pre>
              </details>
            )}
            {tests.length > 0 && (
              <details open>
                <summary className="cursor-pointer text-xs">Test cases</summary>
                <div className="mt-1 space-y-1">
                  {tests.map((t, i) => (
                    <div
                      key={t.id || i}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span>{t.passed ? "✓" : "✗"}</span>
                      <span>{t.label || `Test ${i + 1}`}</span>
                      {!t.visible && (
                        <span className="text-muted-foreground">(hidden)</span>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        );
      }

      default:
        if (Array.isArray(review.student_response_options)) {
          return review.student_response_options.map(
            (option: ReviewOption, idx: number) => (
              <p key={idx}>{parseHtmlToString(option.option_name)}</p>
            )
          );
        }
        return (
          <p>{JSON.stringify(responseData.responseData) || "No response"}</p>
        );
    }
  } catch (error) {
    console.error("Error parsing student response:", error);

    // Fallback for legacy format
    if (Array.isArray(review.student_response_options)) {
      return review.student_response_options.map(
        (option: ReviewOption, idx: number) => (
          <p key={idx}>{parseHtmlToString(option.option_name)}</p>
        )
      );
    }

    return <p>Error displaying response</p>;
  }
};

// Function to render correct answer based on question type
export const renderCorrectAnswer = (
  review: Review,
  questionsData: SectionQuestions | null = null
) => {
  if (!review.correct_options) return <p>No correct answer provided</p>;

  try {
    // Handle both string and array formats
    const correctData =
      typeof review.correct_options === "string"
        ? JSON.parse(review.correct_options)
        : review.correct_options;

    switch (review.question_type) {
      case "ONE_WORD":
        return <p>{correctData.data?.answer || "No answer provided"}</p>;

      case "LONG_ANSWER":
        if (correctData.data?.answer?.content) {
          return <p>{parseHtmlToString(correctData.data.answer.content)}</p>;
        }
        return <p>No answer provided</p>;

      case "NUMERIC":
        if (correctData.data?.validAnswers?.length) {
          return <p>{correctData.data.validAnswers.join(" or ")}</p>;
        }
        return <p>No answer provided</p>;

      case "MCQS":
      case "MCQM":
        if (correctData.data?.correctOptionIds?.length) {
          return (
            <div>
              {correctData.data.correctOptionIds.map((optionId: string) => {
                const optionName = findOptionName(
                  optionId,
                  questionsData,
                  review.question_id
                );
                return <p key={optionId}>{optionName}</p>;
              })}
            </div>
          );
        }
        return <p>No correct options provided</p>;

      case "CODING": {
        const tcs = (correctData.data?.testCases || []) as Array<{
          visible?: boolean;
        }>;
        const total = tcs.length;
        const visible = tcs.filter((t) => t.visible).length;
        const hidden = total - visible;
        return (
          <p className="text-xs text-muted-foreground">
            {visible} visible + {hidden} hidden test case(s) — see test results
            in the response panel.
          </p>
        );
      }

      default:
        if (Array.isArray(review.correct_options)) {
          return review.correct_options.map(
            (option: ReviewOption, idx: number) => (
              <p key={idx}>{parseHtmlToString(option.option_name)}</p>
            )
          );
        }
        return (
          <p>{JSON.stringify(correctData.data) || "No answer provided"}</p>
        );
    }
  } catch (error) {
    console.error("Error parsing correct answer:", error);

    // Fallback for legacy format
    if (Array.isArray(review.correct_options)) {
      return review.correct_options.map((option: ReviewOption, idx: number) => (
        <p key={idx}>{parseHtmlToString(option.option_name)}</p>
      ));
    }

    return <p>Error displaying correct answer</p>;
  }
};
