import { create } from "zustand";

interface TimerState {
    elapsedTime: number; // Time in seconds
    isRunning: boolean;
    startTimestamp: number | null;
    endTimestamp: number | null;
    startTimer: () => void;
    stopTimer: () => void;
    resetTimer: () => void;
    incrementTime: () => void;
    currentTime: () => number;
}

export const useTimerStore = create<TimerState>((set, get) => {
    let interval: NodeJS.Timeout | null = null;

    return {
        elapsedTime: 0,
        isRunning: false,
        startTimestamp: null,
        endTimestamp: null,
        startTimer: () => {
            if (!get().isRunning) {
                interval = setInterval(() => {
                    get().incrementTime();
                }, 1000);
                set({ startTimestamp: Date.now(), isRunning: true });
            }
        },
        stopTimer: () => {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
            set({ endTimestamp: Date.now() });
            set({ isRunning: false });
        },
        resetTimer: () => {
            set({ elapsedTime: 0 });
        },
        incrementTime: () => {
            set((state) => ({ elapsedTime: state.elapsedTime + 1 }));
        },
        currentTime: () => {
            return get().elapsedTime;
        },
    };
});
