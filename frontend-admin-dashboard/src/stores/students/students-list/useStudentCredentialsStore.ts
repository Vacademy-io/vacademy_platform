import { create } from "zustand";
import { StudentCredentialsType } from "@/services/student-list-section/getStudentCredentails";

interface StudentCredentialsStore {
    credentialsMap: Record<string, StudentCredentialsType>;
    setCredentials: (userId: string, credentials: StudentCredentialsType) => void;
    getCredentials: (userId: string) => StudentCredentialsType | null;
    clearCredentials: () => void;
}

export const useStudentCredentialsStore = create<StudentCredentialsStore>((set, get) => ({
    credentialsMap: {},
    setCredentials: (userId: string, credentials: StudentCredentialsType) => {
        set((state) => ({
            credentialsMap: {
                ...state.credentialsMap,
                [userId]: credentials,
            },
        }));
    },
    getCredentials: (userId: string) => {
        return get().credentialsMap[userId] || null;
    },
    clearCredentials: () => {
        set({ credentialsMap: {} });
    },
}));
