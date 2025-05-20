import { create } from "zustand";

interface RefetchStore {
    handleRefetchData: () => void;
    setHandleRefetchData: (fn: () => void) => void;
}

export const useRefetchStore = create<RefetchStore>((set) => ({
    handleRefetchData: () => {
        throw new Error("handleRefetchData has not been initialized.");
    },
    setHandleRefetchData: (fn) => set(() => ({ handleRefetchData: fn })),
}));
