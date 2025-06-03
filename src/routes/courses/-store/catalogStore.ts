// store/useCatalogStore.ts
import { create } from 'zustand';

type Course = any; // Define proper type later if needed

interface CatalogStore {
  instituteId: string | null;
  setInstituteId: (id: string | null) => void;

  instituteData: any;
  setInstituteData: (data: any) => void;

  courses: Course[];
  setCourses: (courses: Course[]) => void;

  loading: boolean;
  setLoading: (val: boolean) => void;

  error: string | null;
  setError: (val: string | null) => void;
}

export const useCatalogStore = create<CatalogStore>((set) => ({
  instituteId: null,
  setInstituteId: (id) => set({ instituteId: id }),

  instituteData: null,
  setInstituteData: (data) => set({ instituteData: data }),

  courses: [],
  setCourses: (courses) => set({ courses }),

  loading: false,
  setLoading: (val) => set({ loading: val }),

  error: null,
  setError: (val) => set({ error: val }),
}));
