import { create } from "zustand";
import { StudyLibrarySessionType } from "./use-study-library-store";

interface selectedSessionStore {
    selectedSession: StudyLibrarySessionType | undefined;
    setSelectedSession: (session: StudyLibrarySessionType | undefined) => void;
}

export const useSelectedSessionStore = create<selectedSessionStore>((set) => ({
    selectedSession: undefined,
    setSelectedSession: (session) => set({ selectedSession: session }),
}));
