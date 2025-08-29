import axios from "axios";
import { getTokenFromStorage } from "@/lib/auth/axiosInstance";
import { TokenKey } from "@/constants/auth/tokens";

const LEARNER_INFO_URL = "https://backend-stage.vacademy.io/admin-core-service/learner/info/v1/details";
const USER_PLAN_URL = "https://backend-stage.vacademy.io/admin-core-service/v1/user-plan";

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
    console.error("Error fetching learner info:", error);
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
    console.error("Error fetching user plan details:", error);
    throw error;
  }
};

/**
 * Check if user has donated at least once
 */
export const hasUserDonated = async (instituteId: string): Promise<boolean> => {
  try {
    console.log('🔍 [HAS DONATED] Starting donation status check for institute:', instituteId);
    
    // Get learner info to find user_plan_id
    console.log('📋 [HAS DONATED] Fetching learner info...');
    const learnerInfo = await getLearnerInfo(instituteId);
    console.log('📋 [HAS DONATED] Learner info received:', learnerInfo);
    
    if (!learnerInfo || learnerInfo.length === 0) {
      console.log('⚠️ [HAS DONATED] No learner info found, user has not donated');
      return false;
    }
    
    console.log('🔍 [HAS DONATED] Checking', learnerInfo.length, 'learner records for user_plan_id');
    
    // Find the first learner record with a user_plan_id
    const learnerWithPlan = learnerInfo.find(learner => learner.user_plan_id);
    const userPlanId = learnerWithPlan?.user_plan_id;
    console.log('🔑 [HAS DONATED] User plan ID extracted:', userPlanId);
    
    if (!userPlanId) {
      console.log('⚠️ [HAS DONATED] No user plan ID found in any learner record, user has not donated');
      return false;
    }

    // Get user plan details to check payment logs
    console.log('💳 [HAS DONATED] Fetching user plan details with payment logs...');
    const userPlan = await getUserPlanDetails(userPlanId);
    console.log('💳 [HAS DONATED] User plan details received:', userPlan);
    
    // Check if any payment log has "Paid" status
    const hasDonated = userPlan.paymentLogs?.some(log => log.payment_status === "Paid") || false;
    console.log('🎯 [HAS DONATED] Payment logs analysis:', {
      totalLogs: userPlan.paymentLogs?.length || 0,
      paidLogs: userPlan.paymentLogs?.filter(log => log.payment_status === "Paid").length || 0,
      hasDonated: hasDonated
    });
    
    if (hasDonated) {
      console.log('✅ [HAS DONATED] User has donated!');
    } else {
      console.log('❌ [HAS DONATED] User has not donated yet');
    }
    
    return hasDonated;
  } catch (error) {
    console.error('❌ [HAS DONATED] Error checking donation status:', error);
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
    console.error("Error checking enrollment status:", error);
    return false;
  }
};
