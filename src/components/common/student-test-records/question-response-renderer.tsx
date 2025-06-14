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
