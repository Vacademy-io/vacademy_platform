import { getInstituteId } from "@/constants/helper";
import { GET_ENROLL_INVITES_BY_USER } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

// Coupon interface based on the API response
export interface Coupon {
  id: string;
  code: string;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "USED";
  sourceType: "USER" | "INSTITUTE" | "PACKAGE";
  sourceId: string;
  allowedEmailIds: string[] | null;
  tag: string;
  generationDate: string;
  redeemStartDate: string;
  redeemEndDate: string;
  usageLimit: number;
  canBeAdded: boolean;
  emailRestricted: boolean;
}

export interface GetEnrollInvitesParams {
  instituteId: string;
}

export interface CouponQueryOptions {
  enabled?: boolean;
  staleTime?: number;
}

export const getEnrollInvites = async (
  params: GetEnrollInvitesParams
): Promise<Coupon[]> => {
  if (!params.instituteId) return [];
  const response = await authenticatedAxiosInstance.get<Coupon[]>(
    GET_ENROLL_INVITES_BY_USER,
    {
      params,
    }
  );
  return response.data;
};

export const useGetEnrollInvites = (options?: CouponQueryOptions) => {
  return useQuery({
    queryKey: ["ENROLL_INVITES"],
    queryFn: async () => {
      const instituteId = await getInstituteId();
      if (isNullOrEmptyOrUndefined(instituteId)) return [];
      return getEnrollInvites({ instituteId });
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes default
  });
};
