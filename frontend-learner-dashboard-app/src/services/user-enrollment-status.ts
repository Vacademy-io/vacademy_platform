import axios from "axios";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { BASE_URL, urlPublicCourseDetails } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";

const LEARNER_INFO_URL = `${BASE_URL}/admin-core-service/learner/info/v1/details`;
const USER_PLAN_URL = `${BASE_URL}/admin-core-service/v1/user-plan`;

export interface EnrolledCourseSummary {
  id: string;
  package_name: string;
  package_session_id: string;
  level_id: string | null;
  level_name: string | null;
  session_id: string | null;
  session_name: string | null;
}

interface LearnerPackagesSearchResponse {
  content: Array<{
    id: string;
    package_name: string;
    package_session_id: string;
    level_id: string | null;
    level_name: string | null;
    session_id: string | null;
    session_name: string | null;
  }>;
  totalPages: number;
  last: boolean;
  number: number;
}

const ENROLLED_PAGE_SIZE = 100;

const fetchEnrolledByType = async (
  instituteId: string,
  type: "PROGRESS" | "COMPLETED",
): Promise<LearnerPackagesSearchResponse["content"]> => {
  const requestPage = async (page: number) => {
    const response =
      await authenticatedAxiosInstance.post<LearnerPackagesSearchResponse>(
        urlPublicCourseDetails,
        {
          status: [],
          level_ids: [],
          faculty_ids: [],
          search_by_name: "",
          tag: [],
          min_percentage_completed: 0,
          max_percentage_completed: 0,
          type,
          sort_columns: { created_at: "DESC" },
        },
        {
          params: { instituteId, page, size: ENROLLED_PAGE_SIZE },
          headers: { accept: "*/*", "Content-Type": "application/json" },
        },
      );
    return response.data;
  };

  const first = await requestPage(0);
  const all = [...(first?.content ?? [])];
  if (first && !first.last && first.totalPages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: first.totalPages - 1 }, (_, i) =>
        requestPage(i + 1),
      ),
    );
    remaining.forEach((page) => all.push(...(page?.content ?? [])));
  }
  return all;
};

// Returns courses the learner is enrolled in — both in-progress and completed —
// so the "All Courses" tab can hide "Enroll Now" for either state.
export const fetchEnrolledCoursePackages = async (
  instituteId: string,
): Promise<EnrolledCourseSummary[]> => {
  const [progress, completed] = await Promise.all([
    fetchEnrolledByType(instituteId, "PROGRESS").catch(() => []),
    fetchEnrolledByType(instituteId, "COMPLETED").catch(() => []),
  ]);

  const byPackageSessionId = new Map<
    string,
    LearnerPackagesSearchResponse["content"][number]
  >();
  // Order matters only for dedup tiebreak; both responses carry the same shape.
  for (const c of progress) byPackageSessionId.set(c.package_session_id, c);
  for (const c of completed) {
    if (!byPackageSessionId.has(c.package_session_id)) {
      byPackageSessionId.set(c.package_session_id, c);
    }
  }

  return Array.from(byPackageSessionId.values()).map((c) => ({
    id: c.id,
    package_name: c.package_name,
    package_session_id: c.package_session_id,
    level_id: c.level_id,
    level_name: c.level_name,
    session_id: c.session_id,
    session_name: c.session_name,
  }));
};

export interface LearnerInfo {
  id: string;
  username: string;
  user_id: string;
  email: string;
  full_name: string;
  address_line: string | null;
  region: string | null;
  city: string | null;
  pin_code: string | null;
  mobile_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  father_name: string;
  mother_name: string;
  parents_mobile_number: string;
  parents_email: string;
  linked_institute_name: string;
  package_session_id: string;
  institute_enrollment_id: string;
  status: string;
  session_expiry_days: string | null;
  institute_id: string;
  face_file_id: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
  parents_to_mother_mobile_number: string;
  parents_to_mother_email: string;
  user_plan_id: string | null;
}

export interface PaymentLog {
  id: string;
  status: string;
  payment_status: string;
  user_id: string;
  vendor: string;
  vendor_id: string;
  date: string;
  currency: string;
  payment_specific_data: string;
  payment_amount: number;
}

export interface UserPlan {
  id: string;
  userId: string;
  paymentPlanId: string;
  planJson: string;
  appliedCouponDiscountId: string | null;
  appliedCouponDiscountJson: string | null;
  enrollInviteId: string | null;
  paymentOptionId: string | null;
  paymentOptionJson: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  paymentLogs: PaymentLog[];
}

/**
 * Get learner information from the API
 */
export const getLearnerInfo = async (instituteId: string): Promise<LearnerInfo[]> => {
  try {
    const token = await getTokenFromStorage(TokenKey.accessToken);
    if (!token) {
      throw new Error("No access token found");
    }

    const response = await axios.get<LearnerInfo[]>(LEARNER_INFO_URL, {
      params: { instituteId },
      headers: {
        accept: "*/*",
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get user plan details to check donation status
 */
export const getUserPlanDetails = async (userPlanId: string): Promise<UserPlan> => {
  try {
    const token = await getTokenFromStorage(TokenKey.accessToken);
    if (!token) {
      throw new Error("No access token found");
    }

    const response = await axios.get<UserPlan>(`${USER_PLAN_URL}/${userPlanId}/with-payment-logs`, {
      headers: {
        accept: "*/*",
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Check if user has donated at least once
 */
export const hasUserDonated = async (instituteId: string): Promise<boolean> => {
  try {
    // Get learner info to find user_plan_id
    const learnerInfo = await getLearnerInfo(instituteId);

    if (!learnerInfo || learnerInfo.length === 0) {
      return false;
    }

    // Find the first learner record with a user_plan_id
    const learnerWithPlan = learnerInfo.find(learner => learner.user_plan_id);
    const userPlanId = learnerWithPlan?.user_plan_id;

    if (!userPlanId) {
      return false;
    }

    // Get user plan details to check payment logs
    const userPlan = await getUserPlanDetails(userPlanId);

    // Check if any payment log has "Paid" status
    const hasDonated = userPlan.paymentLogs?.some(log => log.payment_status === "Paid") || false;

    return hasDonated;
  } catch (error) {
    return false;
  }
};

/**
 * Check if user is enrolled in a specific course
 */
export const isUserEnrolledInCourse = async (
  instituteId: string,
  courseId: string
): Promise<boolean> => {
  try {
    const learnerInfo = await getLearnerInfo(instituteId);

    if (!learnerInfo || learnerInfo.length === 0) {
      return false;
    }

    // Check if any of the enrolled sessions match the course
    // This is a simplified check - you might need to enhance this based on your data structure
    return learnerInfo.some(learner =>
      learner.package_session_id && learner.institute_enrollment_id
    );
  } catch (error) {
    return false;
  }
};
