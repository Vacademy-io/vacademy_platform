import { create } from 'zustand';

export type Criteria = {
    name: string;
    marks: number;
};

type QuestionMarking = {
    questionId?: string;
    questionName: string;
    questionMark: string;
    validAnswers?: string;
    criteria?: Criteria[];
};

type AdaptiveMarkingState = {
    sections: Record<number, QuestionMarking[]>;
    setSectionQuestions: (sectionIndex: number, questions: QuestionMarking[]) => void;
    updateQuestionMark: (sectionIndex: number, questionIndex: number, mark: string) => void;
    addCriteria: (sectionIndex: number, questionIndex: number, criteria: Criteria) => void;
    removeCriteria: (sectionIndex: number, questionIndex: number, criteriaName: string) => void;
    setCriteria: (sectionIndex: number, questionIndex: number, criteria: Criteria[]) => void;
    getSectionMarks: (sectionIndex: number) => number;
    getSectionQuestions: (sectionIndex: number) => QuestionMarking[];
    getQuestionMark: (sectionIndex: number, questionIndex: number) => string;
    getQuestionCriteria: (sectionIndex: number, questionIndex: number) => Criteria[];
    clearSection: (sectionIndex: number) => void;
    clearAll: () => void;
};

export const useAdaptiveMarkingStore = create<AdaptiveMarkingState>((set, get) => ({
    sections: {},

    setSectionQuestions: (sectionIndex, questions) =>
        set((state) => ({
            sections: {
                ...state.sections,
                [sectionIndex]: questions,
            },
        })),

    updateQuestionMark: (sectionIndex, questionIndex, mark) =>
        set((state) => {
            const sectionQuestions = [...(state.sections[sectionIndex] || [])];
            if (sectionQuestions[questionIndex]) {
                // @ts-expect-error : //FIXME this error
                sectionQuestions[questionIndex] = {
                    ...sectionQuestions[questionIndex],
                    questionMark: mark,
                };
            }
            return {
                sections: {
                    ...state.sections,
                    [sectionIndex]: sectionQuestions,
                },
            };
        }),

    addCriteria: (sectionIndex, questionIndex, criteria) =>
        set((state) => {
            const sectionQuestions = [...(state.sections[sectionIndex] || [])];
            if (sectionQuestions[questionIndex]) {
                // @ts-expect-error : //FIXME this error
                sectionQuestions[questionIndex] = {
                    ...sectionQuestions[questionIndex],
                    // @ts-expect-error : //FIXME this error
                    criteria: [...(sectionQuestions[questionIndex].criteria || []), criteria],
                };
            }
            return {
                sections: {
                    ...state.sections,
                    [sectionIndex]: sectionQuestions,
                },
            };
        }),

    removeCriteria: (sectionIndex, questionIndex, criteriaName) =>
        set((state) => {
            const sectionQuestions = [...(state.sections[sectionIndex] || [])];
            if (sectionQuestions[questionIndex]) {
                // @ts-expect-error : //FIXME this error
                sectionQuestions[questionIndex] = {
                    ...sectionQuestions[questionIndex],
                    // @ts-expect-error : //FIXME this error
                    criteria: sectionQuestions[questionIndex].criteria?.filter(
                        (c) => c.name !== criteriaName
                    ),
                };
            }
            return {
                sections: {
                    ...state.sections,
                    [sectionIndex]: sectionQuestions,
                },
            };
        }),

    setCriteria: (sectionIndex, questionIndex, criteria) =>
        set((state) => {
            const sectionQuestions = [...(state.sections[sectionIndex] || [])];
            if (sectionQuestions[questionIndex]) {
                // @ts-expect-error : //FIXME this error
                sectionQuestions[questionIndex] = {
                    ...sectionQuestions[questionIndex],
                    criteria,
                };
            }
            return {
                sections: {
                    ...state.sections,
                    [sectionIndex]: sectionQuestions,
                },
            };
        }),

    getSectionMarks: (sectionIndex) => {
        const state = get();
        const sectionQuestions = state.sections[sectionIndex] || [];
        return sectionQuestions.reduce((total, question) => {
            const questionMark = parseFloat(question.questionMark) || 0;
            return total + questionMark;
        }, 0);
    },
    getSectionQuestions: (sectionIndex) => {
        const state = get();
        return state.sections[sectionIndex] || [];
    },

    getQuestionMark: (sectionIndex, questionIndex) => {
        const state = get();
        return state.sections[sectionIndex]?.[questionIndex]?.questionMark || '';
    },

    getQuestionCriteria: (sectionIndex, questionIndex) => {
        const state = get();
        return state.sections[sectionIndex]?.[questionIndex]?.criteria || [];
    },

    clearSection: (sectionIndex) =>
        set((state) => {
            /* eslint-disable-next-line */
            const { [sectionIndex]: _, ...rest } = state.sections;
            return { sections: rest };
        }),

    clearAll: () => set({ sections: {} }),
}));
