import type { QuestionState } from "@/types/assessment";

export type QuestionStatus =
  | "answered"
  | "answered-marked"
  | "marked"
  | "not-answered"
  | "not-visited";

export const getQuestionStatus = (state?: QuestionState): QuestionStatus => {
  if (!state || !state.isVisited) return "not-visited";
  if (state.isAnswered && state.isMarkedForReview) return "answered-marked";
  if (state.isAnswered) return "answered";
  if (state.isMarkedForReview) return "marked";
  return "not-answered";
};

export const QUESTION_STATUS_GRID_CLASS: Record<QuestionStatus, string> = {
  answered: "bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border-emerald-200",
  "answered-marked":
    "bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border-emerald-200",
  marked: "bg-violet-100 hover:bg-violet-200 text-violet-700 border-violet-200",
  "not-answered": "bg-rose-100 hover:bg-rose-200 text-rose-700 border-rose-200",
  "not-visited": "bg-white hover:bg-gray-100 text-gray-700 border-gray-200",
};

export const QUESTION_STATUS_LIST_CLASS: Record<QuestionStatus, string> = {
  answered: "border-emerald-200 bg-emerald-50",
  "answered-marked": "border-emerald-200 bg-emerald-50",
  marked: "border-violet-200 bg-violet-50",
  "not-answered": "border-rose-200 bg-rose-50",
  "not-visited": "border-gray-200",
};

export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  answered: "Answered",
  "answered-marked": "Answered & Marked for review",
  marked: "Marked for review",
  "not-answered": "Not Answered",
  "not-visited": "Not Visited",
};

export const QUESTION_LEGEND_ORDER: QuestionStatus[] = [
  "answered",
  "not-answered",
  "not-visited",
  "marked",
  "answered-marked",
];
