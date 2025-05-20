import { MyQuestionPaperFormInterface } from "@/types/assessments/question-paper-form";
import { create } from "zustand";

// Define the interface for the Zustand store
interface SidebarState {
    sidebarOpen: boolean;
    setSidebarOpen: (isOpen: boolean) => void;
}

// Create the Zustand store using the interface
export const useSidebarStore = create<SidebarState>((set) => ({
    sidebarOpen: true,
    setSidebarOpen: (isOpen: boolean) => set({ sidebarOpen: isOpen }),
}));

interface UploadedQuestionPapersStore {
    sectionUploadedQuestionPapers: MyQuestionPaperFormInterface[];
    setSectionUploadedQuestionPapers: (
        updater: (prev: MyQuestionPaperFormInterface[]) => MyQuestionPaperFormInterface[],
    ) => void;
}

export const useUploadedQuestionPapersStore = create<UploadedQuestionPapersStore>((set) => ({
    sectionUploadedQuestionPapers: [],
    setSectionUploadedQuestionPapers: (updater) =>
        set((state) => ({
            sectionUploadedQuestionPapers: updater(state.sectionUploadedQuestionPapers),
        })),
}));

interface AssessmentStore {
    savedAssessmentId: string;
    saveAssessmentName: string;
    setSavedAssessmentId: (id: string) => void;
    setSavedAssessmentName: (name: string) => void;
}

export const useSavedAssessmentStore = create<AssessmentStore>((set) => ({
    savedAssessmentId: "",
    saveAssessmentName: "",
    setSavedAssessmentId: (id: string) => set({ savedAssessmentId: id }),
    setSavedAssessmentName: (name: string) => set({ saveAssessmentName: name }),
}));
