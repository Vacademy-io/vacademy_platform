import { create } from 'zustand';

interface ApiInstituteDetailsType {
  [key: string]: any;
}

interface MinimalCatalogState {
  dynamicCourses: any[];
  setDynamicCourses: (courses: any[]) => void;
  apiFetchedInstituteDetails: ApiInstituteDetailsType | null;
  setApiFetchedInstituteDetails: (data: ApiInstituteDetailsType | null) => void;
}

export const useCatalogStore = create<MinimalCatalogState>((set) => ({
  dynamicCourses: [],
  setDynamicCourses: (courses) => set({ dynamicCourses: courses }),
  apiFetchedInstituteDetails: null,
  setApiFetchedInstituteDetails: (data) => set({ apiFetchedInstituteDetails: data }),
}));
