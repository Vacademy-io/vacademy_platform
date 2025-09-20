import { getUserId } from "@/constants/getUserId";
import { GET_REFERRAL_BENEFITS } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { useQuery } from "@tanstack/react-query";

// User detail interface
export interface UserDetail {
  id: string;
  username: string;
  email: string;
  full_name: string;
  address_line: string;
  city: string;
  region: string;
  pin_code: string;
  mobile_number: string;
  date_of_birth: string;
  gender: string;
  password: string;
  profile_pic_file_id: string;
  roles: string[];
  root_user: boolean;
}

// Benefit log interface
export interface BenefitLog {
  benefit_type: string;
  benefit_value: string;
  status: string;
  created_at: string;
}

// Main referral benefit interface
export interface ReferralBenefit {
  user_detail: UserDetail;
  status: string;
  referral_mapping_id: string;
  coupon_code: string;
  benefit_logs: BenefitLog[];
}

// API params interface
export interface GetReferralBenefitsParams {
  userId: string;
  beneficiary: "REFERRER" | "REFEREE";
}

// Query options interface
export interface ReferralBenefitsQueryOptions {
  enabled?: boolean;
  staleTime?: number;
}

export const getReferralBenefits = async (
  params: GetReferralBenefitsParams
): Promise<ReferralBenefit[]> => {
  const response = await authenticatedAxiosInstance.get<ReferralBenefit[]>(
    GET_REFERRAL_BENEFITS,
    {
      params,
    }
  );
  return response.data;
};

export const useGetReferralBenefits = (
  beneficiary: "REFERRER" | "REFEREE" = "REFERRER",
  options?: ReferralBenefitsQueryOptions
) => {
  return useQuery({
    queryKey: ["REFERRAL_BENEFITS", beneficiary],
    queryFn: async () => {
      const userId = await getUserId();
      if (!userId) return [];
      return getReferralBenefits({ userId, beneficiary });
    },
    enabled: options?.enabled ?? true,
  });
};

export const useGetReferrerBenefits = (
  options?: ReferralBenefitsQueryOptions
) => {
  return useGetReferralBenefits("REFERRER", options);
};

export const useGetRefereeBenefits = (
  options?: ReferralBenefitsQueryOptions
) => {
  return useGetReferralBenefits("REFEREE", options);
};
