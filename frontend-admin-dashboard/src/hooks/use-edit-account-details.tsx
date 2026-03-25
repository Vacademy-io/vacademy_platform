import { create } from 'zustand';

interface EditAccountDetailsState {
    showEditAccountDetails: boolean;
    setShowEditAccountDetails: (show: boolean) => void;
}

export const useEditAccountDetailsStore = create<EditAccountDetailsState>((set) => ({
    showEditAccountDetails: false,
    setShowEditAccountDetails: (show) => set({ showEditAccountDetails: show }),
}));
