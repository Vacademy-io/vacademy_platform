import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DripConditionState {
  /** Course ID to drip condition JSON mapping */
  dripConditions: Record<string, string>;

  isDrippingEnable: boolean;

  setIsDrippingEnable: (enabled: boolean) => void;

  /** Set drip condition for a specific course */
  setDripCondition: (courseId: string, dripConditionJson: string) => void;

  /** Get drip condition for a specific course */
  getDripCondition: (courseId: string) => string | null;

  /** Clear drip condition for a specific course */
  clearDripCondition: (courseId: string) => void;

  /** Clear all drip conditions (on logout) */
  clearAll: () => void;
}

export const useDripConditionStore = create<DripConditionState>()(
  persist(
    (set, get) => ({
      dripConditions: {},
      isDrippingEnable: false,
      setIsDrippingEnable: (enabled: boolean) => {
        set({ isDrippingEnable: enabled });
      },
      setDripCondition: (courseId: string, dripConditionJson: string) => {
        set((state) => ({
          dripConditions: {
            ...state.dripConditions,
            [courseId]: dripConditionJson,
          },
        }));
      },

      getDripCondition: (courseId: string) => {
        const condition = get().dripConditions[courseId] || null;
        return condition;
      },

      clearDripCondition: (courseId: string) => {
        set((state) => {
          const newConditions = { ...state.dripConditions };
          delete newConditions[courseId];
          return { dripConditions: newConditions };
        });
      },

      clearAll: () => {
        set({ dripConditions: {} });
      },
    }),
    {
      name: "drip-conditions-storage",
      // Persist both dripConditions and isDrippingEnable
      partialize: (state) => ({
        dripConditions: state.dripConditions,
        isDrippingEnable: state.isDrippingEnable,
      }),
    }
  )
);
