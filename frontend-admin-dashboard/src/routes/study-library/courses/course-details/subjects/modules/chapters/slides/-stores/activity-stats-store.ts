// stores/activity-stats-store.ts
import { create } from 'zustand';

interface ActivityStatsStore {
    isOpen: boolean;
    selectedUserId: string | null;
    selectedUserName: string | null;
    openDialog: (userId: string, userName?: string) => void;
    closeDialog: () => void;
}

export const useActivityStatsStore = create<ActivityStatsStore>((set) => ({
    isOpen: false,
    selectedUserId: null,
    selectedUserName: null,
    openDialog: (userId, userName) =>
        set({
            isOpen: true,
            selectedUserId: userId,
            selectedUserName: userName || null,
        }),
    closeDialog: () =>
        set({
            isOpen: false,
            selectedUserId: null,
            selectedUserName: null,
        }),
}));
