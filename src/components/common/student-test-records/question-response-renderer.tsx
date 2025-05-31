import { parseHtmlToString } from "@/lib/utils";

// Function to render student response based on question type
export const renderStudentResponse = (review: any) => {
  if (!review.student_response_options) return <p>No response</p>;

  try {
    // Handle both string and object formats
    const responseData =
      typeof review.student_response_options === "string"
        ? JSON.parse(review.student_response_options)
        : review.student_response_options;

    // If it's an array, it's in the legacy format with direct option names
    if (Array.isArray(review.student_response_options)) {
      return review.student_response_options.map((option: any, idx: number) => (
        <p key={idx}>{parseHtmlToString(option.option_name)}</p>
      ));
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
        if (responseData.responseData?.optionIds?.length) {
          // If we have the options array with names, use it
          if (Array.isArray(review.options)) {
            return responseData.responseData.optionIds.map(
              (optionId: string) => {
                const option = review.options.find(
                  (opt: any) => opt.id === optionId
                );
                return option ? (
                  <p key={optionId}>{parseHtmlToString(option.option_name)}</p>
                ) : (
                  <p key={optionId}>Option {optionId}</p>
                );
              }
            );
          }
          // Fallback to showing IDs if no option names available
          return (
            <p>
              Selected option ID:{" "}
              {responseData.responseData.optionIds.join(", ")}
            </p>
          );
        }
        return <p>No option selected</p>;

      case "MCQM":
        if (responseData.responseData?.optionIds?.length) {
          // If we have the options array with names, use it
          if (Array.isArray(review.options)) {
            return responseData.responseData.optionIds.map(
              (optionId: string) => {
                const option = review.options.find(
                  (opt: any) => opt.id === optionId
                );
                return option ? (
                  <p key={optionId}>{parseHtmlToString(option.option_name)}</p>
                ) : (
                  <p key={optionId}>Option {optionId}</p>
                );
              }
            );
          }
          // Fallback to showing IDs if no option names available
          return (
            <p>
              Selected option IDs:{" "}
              {responseData.responseData.optionIds.join(", ")}
            </p>
          );
        }
        return <p>No options selected</p>;

      default:
        if (Array.isArray(review.student_response_options)) {
          return review.student_response_options.map(
            (option: any, idx: number) => (
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
      return review.student_response_options.map((option: any, idx: number) => (
        <p key={idx}>{parseHtmlToString(option.option_name)}</p>
      ));
    }

    return <p>Error displaying response</p>;
  }
};

// Function to render correct answer based on question type
export const renderCorrectAnswer = (review: any) => {
  if (!review.correct_options) return <p>No correct answer provided</p>;

  try {
    const correctData = JSON.parse(review.correct_options);

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
            <p>
              Correct option IDs: {correctData.data.correctOptionIds.join(", ")}
            </p>
          );
        }
        return <p>No correct options provided</p>;

      default:
        if (Array.isArray(review.correct_options)) {
          return review.correct_options.map((option: any, idx: number) => (
            <p key={idx}>{parseHtmlToString(option.option_name)}</p>
          ));
        }
        return (
          <p>{JSON.stringify(correctData.data) || "No answer provided"}</p>
        );
    }
  } catch (error) {
    console.error("Error parsing correct answer:", error);

    // Fallback for legacy format
    if (Array.isArray(review.correct_options)) {
      return review.correct_options.map((option: any, idx: number) => (
        <p key={idx}>{parseHtmlToString(option.option_name)}</p>
      ));
    }

    return <p>Error displaying correct answer</p>;
  }
};
