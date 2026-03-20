import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { GET_COURSE_BATCHES } from "@/constants/urls";
import { BatchForSessionType } from "@/types/institute-details/institute-details-interface";

export const fetchBatchesForCourse = async (courseId: string): Promise<BatchForSessionType[]> => {
  if (!courseId) return [];

  try {
    const url = `${GET_COURSE_BATCHES}/${courseId}/batches`;
    const response = await authenticatedAxiosInstance.get(url);
    const data = response.data;

    // Handle both { batches: [...] } and raw array responses
    const batches = Array.isArray(data) ? data : (data?.batches ?? []);
    return batches as BatchForSessionType[];
  } catch (error) {
    console.error(`Failed to fetch batches for course ${courseId}:`, error);
    return [];
  }
};
