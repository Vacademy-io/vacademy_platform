import { create } from "zustand";

interface RefetchStoreUsers {
    handleRefetchUsersData: () => void;
    setHandleRefetchUsersData: (fn: () => void) => void;
}

export const useRefetchUsersStore = create<RefetchStoreUsers>((set) => ({
    handleRefetchUsersData: () => {
        throw new Error("handleRefetchData has not been initialized.");
    },
    setHandleRefetchUsersData: (fn) => set(() => ({ handleRefetchUsersData: fn })),
}));
