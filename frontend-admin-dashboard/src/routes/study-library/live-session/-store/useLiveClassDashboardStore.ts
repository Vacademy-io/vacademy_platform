import { create } from 'zustand';
import { rangeForPreset } from '../-utils/dashboard-format';

/**
 * In-memory state of the live-session page's Dashboard tab — whether it is the
 * open tab, and its filters — so opening a class from the dashboard and pressing
 * back returns to the same view. Like the list-state store, it is deliberately
 * not persisted: a hard refresh lands on the Live tab with the default range.
 */
interface LiveClassDashboardState {
    open: boolean;
    startDate: string;
    endDate: string;
    batchIds: string[];
    teacherIds: string[];

    setOpen: (open: boolean) => void;
    setRange: (start: string, end: string) => void;
    setBatchIds: (ids: string[]) => void;
    setTeacherIds: (ids: string[]) => void;
}

const defaultRange = () => rangeForPreset('last7');

export const useLiveClassDashboardStore = create<LiveClassDashboardState>((set) => ({
    open: false,
    startDate: defaultRange().start,
    endDate: defaultRange().end,
    batchIds: [],
    teacherIds: [],

    setOpen: (open) => set({ open }),
    setRange: (startDate, endDate) => set({ startDate, endDate }),
    setBatchIds: (batchIds) => set({ batchIds }),
    setTeacherIds: (teacherIds) => set({ teacherIds }),
}));
