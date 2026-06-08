import type { FeedbackQuestion, LiveClassFeedbackRow } from '../-types/types';

const TEXT_TYPES = ['text', 'free_text'];

/** Parse a session's feedback-config JSON into its question list. */
export const parseQuestions = (row: LiveClassFeedbackRow): FeedbackQuestion[] => {
    if (!row.feedbackConfigJson) return [];
    try {
        const config = JSON.parse(row.feedbackConfigJson);
        return Array.isArray(config?.questions) ? config.questions : [];
    } catch {
        return [];
    }
};

/** Parse a learner's answers JSON into a question-id → value map. */
export const parseResponses = (row: LiveClassFeedbackRow): Record<string, unknown> => {
    if (!row.feedbackDetails) return {};
    try {
        const parsed = JSON.parse(row.feedbackDetails);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

/**
 * Distinct feedback questions across a set of submissions, in first-seen order.
 * Different sessions can use different feedback forms, so columns/exports are
 * built from the union of questions present in the data.
 */
export const collectQuestions = (rows: LiveClassFeedbackRow[]): FeedbackQuestion[] => {
    const map = new Map<string, FeedbackQuestion>();
    for (const row of rows) {
        for (const q of parseQuestions(row)) {
            if (q?.id && !map.has(q.id)) map.set(q.id, q);
        }
    }
    return Array.from(map.values());
};

export const isStarQuestion = (q: FeedbackQuestion) => q.type === 'star_rating';
export const isTextQuestion = (q: FeedbackQuestion) => TEXT_TYPES.includes(q.type);
export const maxStarsFor = (q: FeedbackQuestion) => q.maxStars ?? q.max_stars ?? 5;

/** The primary star rating for a submission (first star question with an answer). */
export const primaryRating = (row: LiveClassFeedbackRow): number | null => {
    const responses = parseResponses(row);
    for (const q of parseQuestions(row)) {
        if (!isStarQuestion(q)) continue;
        const num = parseFloat(String(responses[q.id]));
        if (!isNaN(num)) return num;
    }
    return null;
};

/** The primary free-text comment for a submission (first non-empty text answer). */
export const primaryComment = (row: LiveClassFeedbackRow): string | null => {
    const responses = parseResponses(row);
    for (const q of parseQuestions(row)) {
        if (!isTextQuestion(q)) continue;
        const value = responses[q.id];
        if (value != null && String(value).trim().length > 0) return String(value);
    }
    return null;
};
