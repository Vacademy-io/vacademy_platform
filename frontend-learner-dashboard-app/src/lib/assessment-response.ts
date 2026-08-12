/**
 * One definition of the saved-answer wire shape, used by both directions.
 *
 * The live-test autosave and the restart/resume restore used to encode and
 * decode this independently, and they disagreed: the save path wrote NUMERIC as
 * `validAnswer`, ONE_WORD/LONG_ANSWER as `answer` and CODING as a full payload,
 * while the restore path read only `optionIds`. Every non-MCQ answer therefore
 * came back empty on resume — the learner's text was gone, the navigator showed
 * "Not Visited", and the submit summary counted the question unattempted.
 *
 * Keep encode and decode in this file so the two can never drift again.
 */

import type {
  CodingAnswerData,
  CodingTestCaseResult,
} from "@/stores/assessment-store";

/** The store's coding answer shape — reused so restore can't drift from it. */
export type CodingResponsePayload = CodingAnswerData;

export interface ResponseData {
  type: string;
  optionIds?: string[];
  answer?: string;
  validAnswer?: number | null;
  language?: string;
  sourceCode?: string;
  verdict?: string;
  passedCount?: number;
  totalCount?: number;
  score?: number;
  totalTimeMs?: number;
  peakMemoryKb?: number;
  testCaseResults?: CodingTestCaseResult[];
  pasteAttemptCount?: number;
}

const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || String(value).trim() === "";

/** Store answer -> wire payload. */
export const encodeResponseData = (
  questionType: string,
  rawAnswer: string[] | undefined,
  codingAnswer?: Partial<CodingResponsePayload>
): ResponseData => {
  const normalizedAnswer = Array.isArray(rawAnswer) ? rawAnswer[0] : rawAnswer;

  if (questionType === "CODING") {
    return {
      type: "CODING",
      language: codingAnswer?.language || "",
      sourceCode: codingAnswer?.sourceCode || "",
      verdict: codingAnswer?.verdict || "",
      passedCount: codingAnswer?.passedCount ?? 0,
      totalCount: codingAnswer?.totalCount ?? 0,
      score: codingAnswer?.score ?? 0,
      totalTimeMs: codingAnswer?.totalTimeMs ?? 0,
      peakMemoryKb: codingAnswer?.peakMemoryKb ?? 0,
      testCaseResults: codingAnswer?.testCaseResults ?? [],
      pasteAttemptCount: codingAnswer?.pasteAttemptCount ?? 0,
    };
  }

  if (questionType === "NUMERIC") {
    const parsed =
      normalizedAnswer !== undefined &&
      normalizedAnswer !== null &&
      !isNaN(parseFloat(normalizedAnswer))
        ? parseFloat(normalizedAnswer)
        : null;
    return { type: "NUMERIC", validAnswer: parsed };
  }

  if (questionType === "ONE_WORD" || questionType === "LONG_ANSWER") {
    return { type: questionType, answer: normalizedAnswer || "" };
  }

  return { type: questionType, optionIds: rawAnswer || [] };
};

/** Wire payload -> store `answers` entry. */
export const decodeAnswer = (responseData?: ResponseData): string[] => {
  if (!responseData) return [];

  switch (responseData.type) {
    case "NUMERIC":
      return isBlank(responseData.validAnswer)
        ? []
        : [String(responseData.validAnswer)];
    case "ONE_WORD":
    case "LONG_ANSWER":
      return responseData.answer ? [responseData.answer] : [];
    case "CODING":
      // Coding answers live in `codingAnswers`, not `answers`.
      return [];
    default:
      return responseData.optionIds ?? [];
  }
};

/** Wire payload -> store `codingAnswers` entry, or null for non-coding types. */
export const decodeCodingAnswer = (
  responseData?: ResponseData
): CodingResponsePayload | null => {
  if (!responseData || responseData.type !== "CODING") return null;
  return {
    language: responseData.language || "",
    sourceCode: responseData.sourceCode || "",
    verdict: responseData.verdict || "",
    passedCount: responseData.passedCount ?? 0,
    totalCount: responseData.totalCount ?? 0,
    score: responseData.score ?? 0,
    totalTimeMs: responseData.totalTimeMs ?? 0,
    peakMemoryKb: responseData.peakMemoryKb ?? 0,
    testCaseResults: responseData.testCaseResults ?? [],
    pasteAttemptCount: responseData.pasteAttemptCount ?? 0,
  };
};

/** Whether a decoded response actually carries an answer. */
export const responseHasAnswer = (responseData?: ResponseData): boolean => {
  const coding = decodeCodingAnswer(responseData);
  if (coding) return coding.sourceCode.trim().length > 0;
  return decodeAnswer(responseData).some((value) => !isBlank(value));
};
