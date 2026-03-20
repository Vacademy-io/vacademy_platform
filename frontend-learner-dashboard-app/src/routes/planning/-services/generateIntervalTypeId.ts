import { useMutation } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { GENERATE_INTERVAL_TYPE_ID } from "@/constants/urls";

// Types
export type IntervalType =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly_month"
  | "yearly_quater";

export interface GenerateIntervalTypeIdRequest {
  intervalType: IntervalType;
  dateYYYYMMDD: string; // Format: YYYY-MM-DD
}

/**
 * Hook to generate interval type ID for planning logs
 * @returns Mutation hook with mutate function
 * @example
 * const { mutate, data, isLoading, error } = useGenerateIntervalTypeId();
 *
 * mutate({
 *   intervalType: "daily",
 *   dateYYYYMMDD: "2025-12-03"
 * });
 */
export const useGenerateIntervalTypeId = () => {
  return useMutation({
    mutationFn: async ({
      intervalType,
      dateYYYYMMDD,
    }: GenerateIntervalTypeIdRequest): Promise<string> => {
      const response = await authenticatedAxiosInstance.get(
        GENERATE_INTERVAL_TYPE_ID,
        {
          params: {
            intervalType,
            dateYYYYMMDD,
          },
        }
      );
      return response.data;
    },
  });
};

/**
 * Helper function to get today's date in YYYY-MM-DD format
 * @returns Today's date as string in YYYY-MM-DD format
 */
export const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Hook to get today's interval type ID based on the interval type passed
 * @returns Mutation hook that automatically uses today's date
 * @example
 * const { mutate, data, isLoading } = useGetTodayIntervalTypeId();
 *
 * // Just pass the interval type, date is automatically set to today
 * mutate({ intervalType: "weekly" });
 */
export const useGetTodayIntervalTypeId = () => {
  return useMutation({
    mutationFn: async ({
      intervalType,
    }: {
      intervalType: IntervalType;
    }): Promise<string> => {
      const todayDate = getTodayDateString();

      const response = await authenticatedAxiosInstance.get(
        GENERATE_INTERVAL_TYPE_ID,
        {
          params: {
            intervalType,
            dateYYYYMMDD: todayDate,
          },
        }
      );
      return response.data;
    },
  });
};
