// stores/activity-stats-store.ts
import { create } from "zustand";

interface ActivityStatsStore {
    isOpen: boolean;
    selectedUserId: string | null;
    openDialog: (userId: string) => void;
    closeDialog: () => void;
}

export const useActivityStatsStore = create<ActivityStatsStore>((set) => ({
    isOpen: false,
    selectedUserId: null,
    openDialog: (userId) =>
        set({
            isOpen: true,
            selectedUserId: userId,
        }),
    closeDialog: () =>
        set({
            isOpen: false,
            selectedUserId: null,
        }),
}));
