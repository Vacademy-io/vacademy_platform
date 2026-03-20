import { create } from 'zustand';
import type { PlanningLog } from '../-types/types';

interface PlanningLogStore {
    selectedLog: PlanningLog | null;
    setSelectedLog: (log: PlanningLog | null) => void;
}

export const usePlanningLogStore = create<PlanningLogStore>((set) => ({
    selectedLog: null,
    setSelectedLog: (log) => set({ selectedLog: log }),
}));
