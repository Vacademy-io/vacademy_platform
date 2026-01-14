import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { GET_COURSE_BATCHES } from "@/constants/urls";
import { BatchForSessionType } from "@/types/institute-details/institute-details-interface";

export const fetchBatchesForCourse = async (courseId: string): Promise<BatchForSessionType[]> => {
  if (!courseId) return [];

  try {
    const url = `${GET_COURSE_BATCHES}/${courseId}/batches`;
    const response = await authenticatedAxiosInstance.get(url);
    
    // The API returns { batches: [...] } or just [...]?
    // Based on prompt: "Response: Should return a list of active batches"
    // Example: [{ ... }]
    // But normally our APIs return data directly or wrapped. 
    // Let's assume array or response.data.batches depending on implementation.
    // The prompt example showed: [ { ... } ]
    
    return response.data as BatchForSessionType[];
  } catch (error) {
    console.error(`Failed to fetch batches for course ${courseId}:`, error);
    return [];
  }
};
