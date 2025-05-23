import { create } from "zustand";
import { Storage } from "@capacitor/storage";
import {
  type QuestionState,
  type AssessmentPreviewData,
  distribution_duration_types,
  type QuestionDto,
} from "../types/assessment";

interface PdfFile {
  fileId: string;
  fileName: string;
  size: number;
  file: File;
  fileUrl: string;
}

interface SectionTimer {
  timeLeft: number;
  isRunning: boolean;
  hasStarted: boolean;
}

interface AssessmentStore {
  assessment: AssessmentPreviewData | null;
  resetAssessment: () => void;
  currentSection: number;
  currentQuestion: QuestionDto | null;
  currentQuestionIndex: number | null;
  questionStates: Record<string, QuestionState>;
  answers: Record<string, string[]>;
  sectionTimers: Record<number, SectionTimer>;
  questionTimers: Record<string, number>;
  setAssessment: (assessment: AssessmentPreviewData) => void;
  setCurrentSection: (sectionIndex: number) => void;
  setCurrentQuestion: (question: QuestionDto) => void;
  setQuestionState: (questionId: string, state: Partial<QuestionState>) => void;
  setAnswer: (questionId: string, answerId: string[]) => void;
  markForReview: (questionId: string) => void;
  clearResponse: (questionId: string) => void;
  updateSectionTimer: (sectionIndex: number, timeLeft: number) => void;
  updateQuestionTimer: (questionId: string, timeLeft: number) => void;
  toggleSectionTimer: (sectionIndex: number, isRunning: boolean) => void;
  isSubmitted: boolean;
  submitAssessment: () => void;
  findNextAvailableSection: () => number | null;
  moveToNextAvailableSection: () => void;
  moveToNextQuestion: () => void;
  entireTestTimer: number;
  setEntireTestTimer: (time: number) => void;
  updateEntireTestTimer: () => void;
  isSectionComplete: (sectionIndex: number) => boolean;
  isSectionAvailable: (sectionIndex: number) => boolean;
  tabSwitchCount: number;
  incrementTabSwitchCount: () => void;
  saveState: () => Promise<void>;
  loadState: () => Promise<void>;
  questionStartTime: Record<string, number>;
  setQuestionStartTime: (questionId: string, startTime: number) => void;
  calculateTimeTaken: (questionId: string) => number;
  questionTimeSpent: Record<string, number>;
  initializeQuestionTime: (questionId: string) => void;
  incrementQuestionTime: (questionId: string) => void;
  // PDF file handling for manual evaluation
  pdfFile: PdfFile | null;
  setPdfFile: (file: PdfFile | null) => void;
}

export const useAssessmentStore = create<AssessmentStore>((set, get) => ({
  assessment: null,
  currentSection: 0,
  currentQuestion: null,
  currentQuestionIndex: 0,
  questionStates: {},
  answers: {},
  sectionTimers: {},
  questionTimers: {},
  questionStartTime: {},
  questionTimeSpent: {},
  pdfFile: null,

  resetAssessment: () =>
    set({
      assessment: null,
      currentSection: 0,
      currentQuestion: null,
      currentQuestionIndex: 0,
      questionStates: {},
      answers: {},
      sectionTimers: {},
      questionTimers: {},
      questionStartTime: {},
      questionTimeSpent: {},
      pdfFile: null,
      tabSwitchCount: 0,
    }),

  setPdfFile: (file) => set({ pdfFile: file }),

  setAssessment: (assessment) =>
    set((state) => {
      if (!assessment || !assessment.section_dtos) {
        console.error("Invalid assessment object:", assessment);
        return state;
      }
      const currentQuestion: QuestionDto =
        assessment.section_dtos[0].question_preview_dto_list[0];
      const questionStates: Record<string, QuestionState> = {};
      const sectionTimers: Record<number, SectionTimer> = {};
      const questionTimers: Record<string, number> = {};
      const questionStartTime: Record<string, number> = {};

      assessment.section_dtos.forEach((section, index) => {
        if (
          assessment.distribution_duration ===
          distribution_duration_types.SECTION
        ) {
          const minutes = section.duration;
          sectionTimers[index] = {
            timeLeft: minutes * 60 * 1000,
            isRunning: !assessment.can_switch_section ? index === 0 : false,
            hasStarted: index === 0,
          };
        }

        section.question_preview_dto_list.forEach((question) => {
          questionStates[question.question_id] = {
            isAnswered: false,
            isVisited: false,
            isMarkedForReview: false,
            isDisabled: false,
          };

          if (
            assessment.distribution_duration ===
            distribution_duration_types.QUESTION
          ) {
            const minutes = question.question_duration;
            questionTimers[question.question_id] = minutes * 60 * 1000;
          }
        });
      });

      const entireTestTimer = assessment.duration * 60;

      return {
        assessment,
        questionStates,
        sectionTimers,
        questionTimers,
        entireTestTimer,
        currentSection: 0,
        currentQuestion,
        questionStartTime,
      };
    }),

  setCurrentSection: (sectionIndex) =>
    set((state) => {
      if (!state.assessment) return {};

      if (!state.assessment.can_switch_section) {
        const previousSectionsComplete = [...Array(sectionIndex)].every(
          (_, idx) => state.sectionTimers[idx]?.timeLeft === 0
        );
        if (!previousSectionsComplete) return {};
      }

      const updatedTimers = { ...state.sectionTimers };
      Object.keys(updatedTimers).forEach((key) => {
        const idx = Number(key);
        if (!state.assessment?.can_switch_section) {
          updatedTimers[idx].isRunning = idx === sectionIndex;
        }
      });

      return {
        currentSection: sectionIndex,
        sectionTimers: updatedTimers,
      };
    }),

  setCurrentQuestion: (question) =>
    set((state) => ({
      currentQuestion: question,
      questionStates: {
        ...state.questionStates,
        [question.question_id]: {
          ...state.questionStates[question.question_id],
          isVisited: true,
        },
      },
      questionStartTime: {
        ...state.questionStartTime,
        [question.question_id]: Date.now(),
      },
    })),

  setQuestionState: (questionId, state) =>
    set((prevState) => ({
      questionStates: {
        ...prevState.questionStates,
        [questionId]: { ...prevState.questionStates[questionId], ...state },
      },
    })),

  setAnswer: (questionId, answerIds) =>
    set((state) => ({
      answers: { ...state.answers, [questionId]: answerIds },
      questionStates: {
        ...state.questionStates,
        [questionId]: {
          ...state.questionStates[questionId],
          isAnswered: answerIds.length > 0,
        },
      },
    })),

  markForReview: (questionId) =>
    set((state) => ({
      questionStates: {
        ...state.questionStates,
        [questionId]: {
          ...state.questionStates[questionId],
          isMarkedForReview:
            !state.questionStates[questionId].isMarkedForReview,
        },
      },
    })),

  clearResponse: (questionId) =>
    set((state) => ({
      answers: { ...state.answers, [questionId]: [] },
      questionStates: {
        ...state.questionStates,
        [questionId]: {
          ...state.questionStates[questionId],
          isAnswered: false,
        },
      },
    })),

  updateSectionTimer: (sectionIndex, timeLeft) =>
    set((state) => {
      if (
        state.assessment?.distribution_duration !==
        distribution_duration_types.SECTION
      ) {
        return {};
      }

      const updatedTimers = {
        ...state.sectionTimers,
        [sectionIndex]: {
          ...state.sectionTimers[sectionIndex],
          timeLeft,
        },
      };

      if (timeLeft === 0 && sectionIndex === state.currentSection) {
        const nextSectionIndex = state.findNextAvailableSection();
        if (nextSectionIndex !== null) {
          updatedTimers[nextSectionIndex].isRunning = true;
          const firstQuestion =
            state.assessment?.section_dtos[nextSectionIndex]
              .question_preview_dto_list[0];

          return {
            sectionTimers: updatedTimers,
            currentSection: nextSectionIndex,
            currentQuestion: firstQuestion,
          };
        } else {
          if (state.entireTestTimer <= 0) {
            return {
              sectionTimers: updatedTimers,
              isSubmitted: true,
            };
          }
        }
      }

      return { sectionTimers: updatedTimers };
    }),

  updateQuestionTimer: (questionId, timeLeft) =>
    set((state) => ({
      questionTimers: {
        ...state.questionTimers,
        [questionId]: timeLeft,
      },
    })),

  toggleSectionTimer: (sectionIndex, isRunning) =>
    set((state) => ({
      sectionTimers: {
        ...state.sectionTimers,
        [sectionIndex]: {
          ...state.sectionTimers[sectionIndex],
          isRunning,
        },
      },
    })),

  isSubmitted: false,
  submitAssessment: () => set({ isSubmitted: true }),

  findNextAvailableSection: () => {
    const state = get();
    if (!state.assessment) return null;

    for (
      let i = state.currentSection + 1;
      i < state.assessment.section_dtos.length;
      i++
    ) {
      if (state.sectionTimers[i]?.timeLeft > 0 && !state.isSectionComplete(i)) {
        return i;
      }
    }

    for (let i = 0; i < state.currentSection; i++) {
      if (state.sectionTimers[i]?.timeLeft > 0 && !state.isSectionComplete(i)) {
        return i;
      }
    }

    return null;
  },

  moveToNextAvailableSection: () => {
    const state = get();
    if (!state.assessment) return;

    if (
      state.assessment?.distribution_duration ===
      distribution_duration_types.SECTION
    ) {
      const currentSectionTimer = state.sectionTimers[state.currentSection];

      if (
        !state.assessment.can_switch_section &&
        currentSectionTimer?.timeLeft > 0
      ) {
        return;
      }

      const updatedTimers = { ...state.sectionTimers };
      if (updatedTimers[state.currentSection]) {
        updatedTimers[state.currentSection].timeLeft = 0;
        updatedTimers[state.currentSection].isRunning = false;
      }

      let nextSection = state.currentSection + 1;
      while (nextSection < state.assessment.section_dtos.length) {
        if (updatedTimers[nextSection]?.timeLeft > 0) {
          updatedTimers[nextSection].isRunning = true;

          set({
            currentSection: nextSection,
            sectionTimers: updatedTimers,
          });

          const firstQuestion =
            state.assessment.section_dtos[nextSection]
              .question_preview_dto_list[0];
          if (firstQuestion) {
            state.setCurrentQuestion(firstQuestion);
          }
          return;
        }
        nextSection++;
      }
    } else {
      const nextSection = state.currentSection + 1;
      if (nextSection < state.assessment.section_dtos.length) {
        set({ currentSection: nextSection });
        const firstQuestion =
          state.assessment.section_dtos[nextSection]
            .question_preview_dto_list[0];
        if (firstQuestion) {
          state.setCurrentQuestion(firstQuestion);
        }
        return;
      }
    }

    if (state.entireTestTimer === 0) {
      set({ isSubmitted: true });
    }
  },

  moveToNextQuestion: () => {
    const state = get();
    const { assessment, currentSection, currentQuestion } = state;
    if (!assessment || !currentQuestion) return;

    const currentSectionQuestions =
      assessment.section_dtos[currentSection].question_preview_dto_list;
    const currentIndex = currentSectionQuestions.findIndex(
      (q) => q.question_id === currentQuestion.question_id
    );

    if (currentIndex < currentSectionQuestions.length - 1) {
      state.setCurrentQuestion(currentSectionQuestions[currentIndex + 1]);
    } else {
      state.moveToNextAvailableSection();
    }
  },

  isSectionComplete: (sectionIndex: number) => {
    const state = get();
    if (!state.assessment) return false;

    const section = state.assessment.section_dtos[sectionIndex];
    if (!section) return false;

    return (
      state.sectionTimers[sectionIndex]?.timeLeft === 0 ||
      section.question_preview_dto_list.every(
        (question) => state.questionStates[question.question_id]?.isAnswered
      )
    );
  },

  isSectionAvailable: (sectionIndex: number) => {
    const state = get();
    if (!state.assessment) return false;

    if (
      state.assessment?.distribution_duration !==
      distribution_duration_types.SECTION
    ) {
      return true;
    }

    if (state.assessment.can_switch_section) {
      return state.sectionTimers[sectionIndex]?.timeLeft > 0;
    }

    return (
      [...Array(sectionIndex)].every(
        (_, idx) => state.sectionTimers[idx]?.timeLeft === 0
      ) && state.sectionTimers[sectionIndex]?.timeLeft > 0
    );
  },

  tabSwitchCount: 0,
  incrementTabSwitchCount: () =>
    set((state) => ({ tabSwitchCount: state.tabSwitchCount + 1 })),

  entireTestTimer: 0,
  setEntireTestTimer: (time) => set({ entireTestTimer: time }),
  updateEntireTestTimer: () =>
    set((state) => {
      const newTimer = Math.max(0, state.entireTestTimer - 1);
      return { entireTestTimer: newTimer };
    }),

  saveState: async () => {
    const state = get();
    const attemptId = state?.assessment?.attempt_id;

    if (!attemptId) {
      console.error("Attempt ID is missing");
      return;
    }

    const dataToSave = {
      assessment: state.assessment,
      currentSection: state.currentSection,
      currentQuestion: state.currentQuestion,
      questionStates: state.questionStates,
      answers: state.answers,
      sectionTimers: state.sectionTimers,
      questionTimers: state.questionTimers,
      entireTestTimer: state.entireTestTimer,
      tabSwitchCount: state.tabSwitchCount,
      questionStartTime: state.questionStartTime,
      questionTimeSpent: state.questionTimeSpent,
      pdfFile: state.pdfFile
        ? {
            id: state.pdfFile.fileId,
            name: state.pdfFile.fileName,
            // size: state.pdfFile.size,
            fileUrl: state.pdfFile.fileUrl,
          }
        : null,
    };

    const storageKey = `ASSESSMENT_STATE_${attemptId}`;

    await Storage.set({
      key: storageKey,
      value: JSON.stringify(dataToSave),
    });
  },

  loadState: async () => {
    const getAttemptId = async () => {
      const { value } = await Storage.get({ key: "Assessment_questions" });

      if (!value) {
        console.error("No data found in Assessment_questions.");
        return null;
      }

      try {
        const parsedData = JSON.parse(value);
        return parsedData?.attempt_id || null;
      } catch (error) {
        console.error("Error parsing Assessment_questions:", error);
        return null;
      }
    };
    const attemptId = await getAttemptId();

    if (!attemptId) {
      console.error("Attempt ID is required to load state");
      return;
    }

    const storageKey = `ASSESSMENT_STATE_${attemptId}`;
    let { value: savedState } = await Storage.get({ key: storageKey });

    if (!savedState) {
      const { value } = await Storage.get({ key: storageKey });
      savedState = value;
    }

    if (savedState) {
      const parsedState = JSON.parse(savedState);
      set(parsedState);
    }
  },

  setQuestionStartTime: (questionId: string, startTime: number) =>
    set((state) => ({
      questionStartTime: {
        ...state.questionStartTime,
        [questionId]: startTime,
      },
    })),

  calculateTimeTaken: (questionId: string) => {
    const state = get();
    const startTime = state.questionStartTime[questionId];
    if (!startTime) return 0;
    return Date.now() - startTime;
  },

  initializeQuestionTime: (questionId) =>
    set((state) => ({
      questionTimeSpent: {
        ...state.questionTimeSpent,
        [questionId]: state.questionTimeSpent[questionId] || 0,
      },
    })),

  incrementQuestionTime: (questionId) =>
    set((state) => ({
      questionTimeSpent: {
        ...state.questionTimeSpent,
        [questionId]: (state.questionTimeSpent[questionId] || 0) + 1,
      },
    })),
}));

export default useAssessmentStore;
