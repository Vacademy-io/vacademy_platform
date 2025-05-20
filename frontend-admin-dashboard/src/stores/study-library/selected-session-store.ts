import { create } from "zustand";
import { StudyLibrarySessionType } from "@/stores/study-library/use-study-library-store";

interface selectedSessionStore {
    selectedSession: StudyLibrarySessionType | undefined;
    setSelectedSession: (session: StudyLibrarySessionType | undefined) => void;
    resetSelectedSessionStore: () => void;
}

export const useSelectedSessionStore = create<selectedSessionStore>((set) => ({
    selectedSession: undefined,
    setSelectedSession: (session) => set({ selectedSession: session }),
    resetSelectedSessionStore: () => set({ selectedSession: undefined }),
}));
