import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/lib/auth/axiosInstance";
import { Preferences } from "@capacitor/preferences";
import type {
  ListPlanningLogsRequest,
  ListPlanningLogsResponse,
  PlanningLog,
} from "../-types/types";
import { LIST_PLANNING_LOGS } from "@/constants/urls";

interface UseListPlanningLogsOptions {
  pageNo?: number;
  pageSize?: number;
  filters?: ListPlanningLogsRequest;
  enabled?: boolean;
}

/**
 * Hook to fetch planning logs with filters and pagination
 */
export const useListPlanningLogs = ({
  pageNo = 0,
  pageSize = 10,
  filters = {},
  enabled = true,
}: UseListPlanningLogsOptions = {}) => {
  return useQuery({
    queryKey: ["learner-planning-logs", pageNo, pageSize, filters],
    queryFn: async () => {
      // Get institute ID from preferences
      const instituteIdPref = await Preferences.get({ key: "InstituteId" });
      const instituteId = instituteIdPref.value;

      if (!instituteId) {
        throw new Error("Institute ID not found");
      }

      // Make API request with filters
      const response = await axiosInstance.post<ListPlanningLogsResponse>(
        LIST_PLANNING_LOGS,
        {
          ...filters,
          statuses: ["ACTIVE"],
          is_shared_with_student: true,
        },
        {
          params: {
            instituteId,
            pageNo,
            pageSize,
          },
        }
      );

      return {
        ...response.data,
        content: response.data.content as PlanningLog[],
      };
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });
};
