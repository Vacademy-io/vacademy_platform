import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Pie, PieChart } from "recharts";

interface ResponseData {
  attempted: number;
  skipped: number;
}

const chartConfig = {
  correct: {
    label: "Correct",
    color: "hsl(var(--chart-1))",
  },
  skipped: {
    label: "Skipped",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

export function ResponseBreakdownComponent({
  responseData,
}: {
  responseData: ResponseData;
}) {
  const chartData = [
    {
      responseType: "correct",
      value: responseData.attempted,
      fill: "#97D4B4",
    },
    {
      responseType: "skipped",
      value: responseData.skipped,
      fill: "#EEE",
    },
  ];
  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square h-[180px]"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="responseType"
          innerRadius={42}
          strokeWidth={2}
        />
      </PieChart>
    </ChartContainer>
  );
}

import { parseHtmlToString } from "@/lib/utils";

// Function to render student response based on question type
export const renderStudentResponse = (review: any) => {
  if (!review.student_response_options) return <p>No response</p>;

  try {
    // Parse the JSON string
    const responseData =
      typeof review.student_response_options === "string"
        ? JSON.parse(review.student_response_options)
        : review.student_response_options;

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
    return <p>Error displaying response: {String(error)}</p>;
  }
};

// Function to render correct answer based on question type
export const renderCorrectAnswer = (review: any) => {
  if (!review.correct_options) return <p>No correct answer provided</p>;

  try {
    // Parse the JSON string
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
    return <p>Error displaying correct answer: {String(error)}</p>;
  }
};
