import { create } from "zustand";

interface InstituteFeatureStore {
  instituteId: string | null;
  setInstituteId: (id: string) => void;
  showForInstitutes: (instituteIds: string[]) => boolean;
}

export const useInstituteFeatureStore = create<InstituteFeatureStore>(
  (set, get) => ({
    instituteId: null,
    setInstituteId: (id) => set({ instituteId: id }),
    showForInstitutes: (instituteIds: string[]) => {
      const { instituteId } = get();
      if (!instituteId) return false;
      return instituteIds.includes(instituteId);
    },
  })
);
