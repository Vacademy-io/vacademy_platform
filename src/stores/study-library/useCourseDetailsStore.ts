import { create } from "zustand";
import { CourseStructureResponse } from "@/types/institute-details/course-details-interface";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { GET_COURSE_DETAILS } from "@/constants/urls";

interface CourseDetailsStore {
  courseDetails: Record<string, CourseStructureResponse>;
  fetchCourseDetails: (
    packageId: string
  ) => Promise<CourseStructureResponse | null>;
  getCourseDetails: (packageId: string) => CourseStructureResponse | null;
  resetStore: () => void;
}

export const useCourseDetailsStore = create<CourseDetailsStore>((set, get) => ({
  courseDetails: {},

  fetchCourseDetails: async (packageId: string) => {
    // Check if already cached
    const { courseDetails } = get();
    if (courseDetails[packageId]) {
      return courseDetails[packageId];
    }

    try {
      const response = await authenticatedAxiosInstance({
        method: "GET",
        url: GET_COURSE_DETAILS,
        params: { packageId },
      });

      const data = response?.data as CourseStructureResponse;

      // Cache the data
      set((state) => ({
        courseDetails: {
          ...state.courseDetails,
          [packageId]: data,
        },
      }));

      return data;
    } catch (error) {
      console.error("Failed to fetch course details:", error);
      return null;
    }
  },

  getCourseDetails: (packageId: string) => {
    const { courseDetails } = get();
    return courseDetails[packageId] || null;
  },

  resetStore: () => set({ courseDetails: {} }),
}));
