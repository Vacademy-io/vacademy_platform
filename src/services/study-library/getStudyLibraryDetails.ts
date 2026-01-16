// services/study-library/getStudyLibraryDetails.ts
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { INIT_STUDY_LIBRARY } from "@/constants/urls";
import { useStudyLibraryStore, SubjectType } from "@/stores/study-library/use-study-library-store";
import { getInstituteId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { queryOptions } from "@tanstack/react-query";

export const fetchStudyLibraryDetails = async (packageSessionId: string): Promise<SubjectType[]> => {
  // Favor the structured getInstituteId utility
  const idFromDetails = await getInstituteId();

  // Fallback to stand-alone key or hardcoded ID if details are missing
  const effectiveInstituteId = idFromDetails;


  const response = await authenticatedAxiosInstance.get(INIT_STUDY_LIBRARY, {
    params: {
      instituteId: effectiveInstituteId,
      packageSessionId: packageSessionId,
    },
  });
  return response.data;
};

/**
 * Query options for fetching study library details
 * Cached for 5 minutes to reduce API calls while keeping data fresh
 */
export const getStudyLibraryQuery = (packageSessionId: string | null) =>
  queryOptions({
    queryKey: ["study-library", packageSessionId],
    queryFn: async () => {
      if (!packageSessionId) {
        throw new Error("Package session ID is required");
      }
      return await fetchStudyLibraryDetails(packageSessionId);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - balance between freshness and performance
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    enabled: !!packageSessionId,
  });

export const useStudyLibraryQuery = (packageSessionId: string) => {
  const setStudyLibraryData = useStudyLibraryStore(
    (state) => state.setStudyLibraryData
  );

  return {
    queryKey: ["GET_INIT_STUDY_LIBRARY"],
    queryFn: async () => {
      const data = await fetchStudyLibraryDetails(packageSessionId);
      setStudyLibraryData(data);
      return data;
    },
    staleTime: 60000,
  };
};
