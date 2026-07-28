import { create } from 'zustand';

interface SelectionState {
    course: string;
    session: string;
    level: string;
    learnerName: string;
    pacageSessionId: string;
    setPacageSessionId: (id: string) => void;
    setCourse: (course: string) => void;
    setSession: (session: string) => void;
    setLevel: (level: string) => void;
    setLearnerName: (learnerName: string) => void;
}

export const usePacageDetails = create<SelectionState>((set) => ({
    course: '',
    session: '',
    level: '',
    learnerName: '',
    pacageSessionId: '',
    setPacageSessionId: (id) => set({ pacageSessionId: id }),
    setCourse: (course) => set({ course }),
    setSession: (session) => set({ session }),
    setLevel: (level) => set({ level }),
    setLearnerName: (learnerName) => set({ learnerName }),
}));
