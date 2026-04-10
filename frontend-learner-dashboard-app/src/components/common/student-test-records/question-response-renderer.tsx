import { sanitizeHtml } from "@/lib/utils";
import "katex/dist/katex.min.css";

/**
 * Decode HTML entities that may be double-encoded in API responses.
 * e.g. "&lt;span&gt;" → "<span>" or "&amp;lt;" → "<"
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  const textarea = document.createElement("textarea");
  // Decode up to 2 times to handle double-encoding
  textarea.innerHTML = text;
  let decoded = textarea.value;
  // If it still looks like it has encoded entities, decode once more
  if (decoded.includes("&lt;") || decoded.includes("&gt;") || decoded.includes("&amp;")) {
    textarea.innerHTML = decoded;
    decoded = textarea.value;
  }
  return decoded;
}

/**
 * Renders HTML content safely, preserving KaTeX/LaTeX math spans.
 * Decodes HTML entities first (handles double-encoded API content),
 * then sanitizes to strip dangerous tags while keeping formatting.
 */
const HtmlContent = ({ html, className }: { html: string; className?: string }) => (
  <span
    className={className}
    dangerouslySetInnerHTML={{ __html: sanitizeHtml(decodeHtmlEntities(html)) }}
  />
);

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

// Function to find option HTML by ID from questions data
const findOptionContent = (
  optionId: string,
  questionsData: SectionQuestions | null,
  questionId: string
): { html: string; found: boolean } => {
  if (!questionsData) return { html: optionId, found: false };

  for (const sectionQuestions of Object.values(questionsData)) {
    const question = sectionQuestions.find((q) => q.question_id === questionId);
    if (question) {
      const option = [
        ...(question.options || []),
        ...(question.options_with_explanation || []),
      ].find((opt) => opt.id === optionId);

      if (option?.text?.content) {
        return { html: option.text.content, found: true };
      }
    }
  }
  return { html: optionId, found: false };
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
          <p key={idx}><HtmlContent html={option.option_name} /></p>
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
          const optionId = responseData.responseData.optionIds[0];
          const { html, found } = findOptionContent(
            optionId,
            questionsData,
            review.question_id
          );
          return <p>{found ? <HtmlContent html={html} /> : html}</p>;
        }
        return <p>No option selected</p>;

      case "MCQM":
        if (responseData.responseData?.optionIds?.length) {
          return (
            <div>
              {responseData.responseData.optionIds.map((optionId: string) => {
                const { html, found } = findOptionContent(
                  optionId,
                  questionsData,
                  review.question_id
                );
                return <p key={optionId}>{found ? <HtmlContent html={html} /> : html}</p>;
              })}
            </div>
          );
        }
        return <p>No options selected</p>;

      default:
        if (Array.isArray(review.student_response_options)) {
          return review.student_response_options.map(
            (option: ReviewOption, idx: number) => (
              <p key={idx}><HtmlContent html={option.option_name} /></p>
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
          <p key={idx}><HtmlContent html={option.option_name} /></p>
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
          return <p><HtmlContent html={correctData.data.answer.content} /></p>;
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
                const { html, found } = findOptionContent(
                  optionId,
                  questionsData,
                  review.question_id
                );
                return <p key={optionId}>{found ? <HtmlContent html={html} /> : html}</p>;
              })}
            </div>
          );
        }
        return <p>No correct options provided</p>;

      default:
        if (Array.isArray(review.correct_options)) {
          return review.correct_options.map(
            (option: ReviewOption, idx: number) => (
              <p key={idx}><HtmlContent html={option.option_name} /></p>
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
        <p key={idx}><HtmlContent html={option.option_name} /></p>
      ));
    }

    return <p>Error displaying correct answer</p>;
  }
};
