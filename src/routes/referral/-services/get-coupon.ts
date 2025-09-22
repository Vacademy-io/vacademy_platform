import { getUserId } from "@/constants/getUserId";
import { GET_COUPON_CODE } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
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

export interface GetCouponParams {
  sourceId: string | null;
  sourceType: "USER";
}

export interface CouponQueryOptions {
  enabled?: boolean;
  staleTime?: number;
}

export const getCoupons = async (
  params: GetCouponParams
): Promise<Coupon[]> => {
  if (!params.sourceId) return [];
  const response = await authenticatedAxiosInstance.get<Coupon[]>(
    GET_COUPON_CODE,
    {
      params,
    }
  );
  return response.data;
};

export const useGetCoupons = (options?: CouponQueryOptions) => {
  return useQuery({
    queryKey: ["COUPONS"],
    queryFn: async () => {
      const userId = await getUserId();
      return getCoupons({ sourceId: userId, sourceType: "USER" });
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes default
  });
};
