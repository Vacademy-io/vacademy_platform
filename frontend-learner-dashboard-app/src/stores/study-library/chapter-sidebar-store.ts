// stores/content-store.ts
import { create } from "zustand";
import { Slide } from "@/hooks/study-library/use-slides";
import type { DripConditionEvaluation } from "@/utils/drip-conditions/evaluateDripCondition";

interface ContentStore {
  items: Slide[];
  activeItem: Slide | null;
  slideEvaluations: Record<string, DripConditionEvaluation>; // Map of slideId -> evaluation result
  currentPackageSessionId: string | null; // package_session_id of the course currently being viewed
  setItems: (items: Slide[]) => void;
  setActiveItem: (item: Slide | null) => void;
  setSlideEvaluations: (
    evaluations: Record<string, DripConditionEvaluation>
  ) => void;
  setCurrentPackageSessionId: (id: string | null) => void;
}

export const useContentStore = create<ContentStore>((set) => ({
  items: [],
  activeItem: null,
  slideEvaluations: {},
  currentPackageSessionId: null,
  setItems: (items) => set({ items }),
  setActiveItem: (item) => set({ activeItem: item }),
  setSlideEvaluations: (evaluations) => set({ slideEvaluations: evaluations }),
  setCurrentPackageSessionId: (id) => set({ currentPackageSessionId: id }),
}));
