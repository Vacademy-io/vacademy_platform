import { create } from "zustand";
import {
  PlayGamificationData,
  getCachedGamification,
} from "@/services/play-gamification";

interface PlayGamificationStore {
  data: PlayGamificationData | null;
  isLoading: boolean;
  setData: (data: PlayGamificationData) => void;
  loadFromCache: (instituteId: string) => void;
}

const DEFAULT_DATA: PlayGamificationData = {
  currentStreak: 0,
  longestStreak: 0,
  lastActivityDate: null,
  weeklyDots: Array(7).fill(false),
  totalXp: 0,
  todayXp: 0,
  level: 1,
  xpToNextLevel: 500,
  badges: [],
};

export const usePlayGamificationStore = create<PlayGamificationStore>(
  (set) => ({
    data: null,
    isLoading: true,

    setData: (data) => set({ data, isLoading: false }),

    loadFromCache: (instituteId) => {
      const cached = getCachedGamification(instituteId);
      set({ data: cached ?? DEFAULT_DATA, isLoading: false });
    },
  })
);
