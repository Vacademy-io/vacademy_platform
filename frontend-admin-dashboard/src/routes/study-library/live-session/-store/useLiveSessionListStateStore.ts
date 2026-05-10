import { create } from 'zustand';
import { SessionStatus } from '../-constants/enums';

/**
 * In-memory cache of the Live-Session list page's tab + pagination so that
 * navigating to a class detail and pressing browser-back returns the admin to
 * the same tab and page they left from.
 *
 * Intentionally NOT persisted (no localStorage / sessionStorage middleware) —
 * a hard refresh resets to the Live tab + page 0 by design. The list page
 * sources its initial state from here on mount and writes back on every
 * tab/page change.
 */
interface LiveSessionListState {
    selectedTab: SessionStatus;
    currentPage: number;
    setListState: (next: { selectedTab: SessionStatus; currentPage: number }) => void;
}

export const useLiveSessionListStateStore = create<LiveSessionListState>((set) => ({
    selectedTab: SessionStatus.LIVE,
    currentPage: 0,
    setListState: ({ selectedTab, currentPage }) => set({ selectedTab, currentPage }),
}));
