import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StoredDripCondition } from "@/utils/drip-conditions";

interface DripConditionState {
  /** Course ID to drip condition JSON mapping */
  dripConditions: Record<string, string>;

  isDrippingEnable: boolean;

  /**
   * Institute opted into enforcing settings-blob conditions. Off unless an
   * admin explicitly turned it on — see ResolvedDripConditions.
   */
  applyConfiguredRules: boolean;

  /**
   * The master switch as read by the NEW settings path, held separately from
   * `isDrippingEnable` on purpose.
   *
   * `isDrippingEnable` gates the original row-level drip path and is owned by
   * the catalogue page. Writing to it from the course page would switch that
   * old path on for a learner who deep-linked straight into a course and had
   * therefore never had it set — a behaviour change nobody asked for. The new
   * path reads this field instead and leaves the old one alone.
   */
  dripSettingsEnabled: boolean;

  /**
   * Every drip condition the institute has configured, as saved by the admin
   * dashboard into COURSE_SETTING. Keyed by level + level_id inside each entry,
   * so one flat list covers every course.
   */
  conditions: StoredDripCondition[];

  /**
   * packageSessionId -> ISO enrollment date, the day 1 of any `relative_date`
   * rule. Cached because it never changes for a given enrollment and a missing
   * value silently unlocks day-wise content.
   */
  enrollmentDates: Record<string, string>;

  setIsDrippingEnable: (enabled: boolean) => void;

  setApplyConfiguredRules: (apply: boolean) => void;

  setDripSettingsEnabled: (enabled: boolean) => void;

  setConditions: (conditions: StoredDripCondition[]) => void;

  setEnrollmentDate: (packageSessionId: string, isoDate: string) => void;

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
      applyConfiguredRules: false,
      dripSettingsEnabled: false,
      conditions: [],
      enrollmentDates: {},
      setIsDrippingEnable: (enabled: boolean) => {
        set({ isDrippingEnable: enabled });
      },
      setApplyConfiguredRules: (apply: boolean) => {
        set({ applyConfiguredRules: apply === true });
      },
      setDripSettingsEnabled: (enabled: boolean) => {
        set({ dripSettingsEnabled: enabled === true });
      },
      setConditions: (conditions: StoredDripCondition[]) => {
        set({ conditions: Array.isArray(conditions) ? conditions : [] });
      },
      setEnrollmentDate: (packageSessionId: string, isoDate: string) => {
        if (!packageSessionId || !isoDate) return;
        set((state) =>
          state.enrollmentDates[packageSessionId] === isoDate
            ? state
            : {
                enrollmentDates: {
                  ...state.enrollmentDates,
                  [packageSessionId]: isoDate,
                },
              }
        );
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
        set({
          dripConditions: {},
          conditions: [],
          enrollmentDates: {},
          applyConfiguredRules: false,
          dripSettingsEnabled: false,
        });
      },
    }),
    {
      name: "drip-conditions-storage",
      // Persist both dripConditions and isDrippingEnable
      partialize: (state) => ({
        dripConditions: state.dripConditions,
        isDrippingEnable: state.isDrippingEnable,
        applyConfiguredRules: state.applyConfiguredRules,
        dripSettingsEnabled: state.dripSettingsEnabled,
        conditions: state.conditions,
        enrollmentDates: state.enrollmentDates,
      }),
    }
  )
);
