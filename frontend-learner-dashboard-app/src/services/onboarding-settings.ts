import { getInstituteId } from "@/constants/helper";
import { BASE_URL } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";

// ONBOARDING_SETTING — the same institute-wide feature toggle the admin
// dashboard's useOnboardingSettings hook reads (default OFF). Gates the
// "Onboarding" entry in the learner's account/profile menu so it doesn't
// appear for institutes that haven't turned the feature on.
const SETTING_KEY = "ONBOARDING_SETTING";

export async function isOnboardingEnabled(instituteId?: string): Promise<boolean> {
  const id = instituteId ?? (await getInstituteId());
  if (!id) return false;
  try {
    const res = await authenticatedAxiosInstance.get<{
      key: string;
      name: string;
      data: { enabled?: boolean } | null;
    }>(`${BASE_URL}/admin-core-service/institute/setting/v1/get`, {
      params: { instituteId: id, settingKey: SETTING_KEY },
    });
    return res.data?.data?.enabled === true;
  } catch {
    return false;
  }
}
