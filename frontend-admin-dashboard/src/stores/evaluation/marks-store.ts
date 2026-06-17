import { create } from 'zustand';

interface MarkEntry {
    section_id: string;
    question_id: string;
    status: string;
    marks: number;
    // Populated at submit time from `feedbackByQuestion`; sent to the backend as
    // `evaluator_feedback` and shown to the learner.
    evaluator_feedback?: string;
}

interface MarksStore {
    marksData: MarkEntry[];
    // Feedback is tracked separately from marks so entering a remark never fakes a
    // "0" score — this keeps marks and feedback independently validatable.
    feedbackByQuestion: Record<string, string>;
    addOrUpdateMark: (entry: MarkEntry) => void;
    setQuestionFeedback: (sectionId: string, questionId: string, feedback: string) => void;
    resetMarks: () => void;
}

// Stable key for the per-question feedback map.
export const feedbackKey = (sectionId: string, questionId: string) =>
    `${sectionId}__${questionId}`;

export const useMarksStore = create<MarksStore>((set) => ({
    marksData: [],
    feedbackByQuestion: {},
    addOrUpdateMark: (entry) =>
        set((state) => {
            const existingIndex = state.marksData.findIndex(
                (item) =>
                    item.section_id === entry.section_id && item.question_id === entry.question_id
            );

            if (existingIndex !== -1) {
                // Merge so partial updates don't clobber sibling fields.
                const updatedMarksData = [...state.marksData];
                updatedMarksData[existingIndex] = {
                    ...updatedMarksData[existingIndex],
                    ...entry,
                };
                return { marksData: updatedMarksData };
            }
            return { marksData: [...state.marksData, entry] };
        }),
    setQuestionFeedback: (sectionId, questionId, feedback) =>
        set((state) => ({
            feedbackByQuestion: {
                ...state.feedbackByQuestion,
                [feedbackKey(sectionId, questionId)]: feedback,
            },
        })),
    resetMarks: () => set({ marksData: [], feedbackByQuestion: {} }),
}));
