import { create } from "zustand";

// Define the type for roles and users
interface Role {
    roleId: string;
    roleName: string;
}

interface User {
    userId: string;
    email: string;
    name: string;
    roles: Role[];
    status: string;
}

// Define the type for the state
interface AccessControlState {
    status?: string;
    assessment_creation_access?: User[];
    live_assessment_notification?: User[];
    assessment_submission_and_report_access?: User[];
    evaluation_process?: User[];
    setAccessControlData: (data: Partial<AccessControlState>) => void;
    getAccessControlData: () => AccessControlState;
    reset: () => void;
}

// ✅ Define the initial empty state (excluding functions)
const initialState: Omit<
    AccessControlState,
    "setAccessControlData" | "getAccessControlData" | "reset"
> = {
    status: undefined,
    assessment_creation_access: undefined,
    live_assessment_notification: undefined,
    assessment_submission_and_report_access: undefined,
    evaluation_process: undefined,
};

export const useAccessControlStore = create<AccessControlState>((set, get) => ({
    ...initialState,
    setAccessControlData: (data) => set((state) => ({ ...state, ...data })),
    getAccessControlData: () => get(),
    reset: () => set(() => ({ ...initialState })), // ✅ Properly resets to initial state
}));
