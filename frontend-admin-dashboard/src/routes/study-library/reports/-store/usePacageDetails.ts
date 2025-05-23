import { create } from "zustand";

interface SelectionState {
    course: string;
    session: string;
    level: string;
    pacageSessionId: string;
    setPacageSessionId: (id: string) => void;
    setCourse: (course: string) => void;
    setSession: (session: string) => void;
    setLevel: (level: string) => void;
}

export const usePacageDetails = create<SelectionState>((set) => ({
    course: "",
    session: "",
    level: "",
    pacageSessionId: "",
    setPacageSessionId: (id) => set({ pacageSessionId: id }),
    setCourse: (course) => set({ course }),
    setSession: (session) => set({ session }),
    setLevel: (level) => set({ level }),
}));
