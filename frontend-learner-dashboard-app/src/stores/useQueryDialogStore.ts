import { create } from 'zustand';

export type QueryDialogTab = 'raise' | 'my-queries';

/**
 * Global open/close state for the learner "Raise a query" dialog, so both entry points (the top-bar
 * "?" icon and the dashboard card) can open the same single dialog instance rendered in the navbar.
 * `open(tab)` lets a caller land directly on a tab (e.g. the dashboard card → "My queries").
 */
interface QueryDialogStore {
    isOpen: boolean;
    initialTab: QueryDialogTab;
    open: (tab?: QueryDialogTab) => void;
    close: () => void;
}

export const useQueryDialogStore = create<QueryDialogStore>((set) => ({
    isOpen: false,
    initialTab: 'raise',
    open: (tab) => set({ isOpen: true, initialTab: tab ?? 'raise' }),
    close: () => set({ isOpen: false }),
}));
