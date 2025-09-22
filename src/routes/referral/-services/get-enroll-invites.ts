import { getInstituteId } from "@/constants/helper";
import { GET_ENROLL_INVITES_BY_USER } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

// Coupon interface based on the API response
export interface Invite {
  currency: string;
  end_date: string | null;
  id: string;
  institute_custom_fields: string | null;
  institute_id: string;
  invite_code: string;
  learner_access_days: number | null;
  name: string;
  package_session_to_payment_options: string | null;
  start_date: string | null;
  status: string;
  tag: string;
  vendor: string;
  vendor_id: string;
  web_page_meta_data_json: string;
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
): Promise<Invite[]> => {
  if (!params.instituteId) return [];
  const response = await authenticatedAxiosInstance.get<Invite[]>(
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
