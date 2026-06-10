import { create } from 'zustand';

/**
 * Global open/close state for the learner "Raise a query" dialog, so both entry points (the top-bar
 * "?" icon and the dashboard card) can open the same single dialog instance rendered in the navbar.
 */
interface QueryDialogStore {
    isOpen: boolean;
    open: () => void;
    close: () => void;
}

export const useQueryDialogStore = create<QueryDialogStore>((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
}));
