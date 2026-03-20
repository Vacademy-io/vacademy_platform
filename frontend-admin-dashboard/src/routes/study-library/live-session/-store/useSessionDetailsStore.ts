import { create } from 'zustand';
import { SessionBySessionIdResponse } from '../-services/utils';

interface SessionDetailsState {
    sessionDetails: SessionBySessionIdResponse | null;
    isLoading: boolean;
    error: Error | null;
    setSessionDetails: (sessionDetails: SessionBySessionIdResponse) => void;
    clearSessionDetails: () => void;
}

export const useSessionDetailsStore = create<SessionDetailsState>((set) => ({
    sessionDetails: null,
    isLoading: false,
    error: null,
    setSessionDetails: (sessionDetails: SessionBySessionIdResponse) => {
        set({ sessionDetails });
    },
    clearSessionDetails: () => set({ sessionDetails: null, error: null }),
}));
