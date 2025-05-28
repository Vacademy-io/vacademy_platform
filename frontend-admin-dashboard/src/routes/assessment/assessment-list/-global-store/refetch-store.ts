import { create } from "zustand";

interface RefetchStoreAssessment {
    handleRefetchDataAssessment: () => void;
    setHandleRefetchDataAssessment: (fn: () => void) => void;
}

export const useRefetchStoreAssessment = create<RefetchStoreAssessment>((set) => ({
    handleRefetchDataAssessment: () => {
        throw new Error("handleRefetchData has not been initialized.");
    },
    setHandleRefetchDataAssessment: (fn) => set(() => ({ handleRefetchDataAssessment: fn })),
}));
