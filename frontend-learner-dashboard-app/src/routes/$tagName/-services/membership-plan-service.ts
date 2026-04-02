import axios from "axios";
import { urlCourseDetails } from "@/constants/urls";

export interface MembershipPlan {
    id: string;
    package_name: string;
    min_plan_actual_price: number;
    currency: string;
    package_type: string;
    enroll_invite_id: string;
    package_session_id: string;
    level_id: string;
    level_name: string;
    thumbnail_file_id?: string;
    course_banner_media_id?: string;
    course_preview_image_media_id?: string;
    [key: string]: any;
}

/**
 * Fetches membership plans from the API
 * @param instituteId - The institute ID to fetch plans for
 * @returns Promise with array of membership plans
 */
export const getMembershipPlans = async (
    instituteId: string
): Promise<MembershipPlan[]> => {
    try {
        const response = await axios.post(
            urlCourseDetails,
            {
                status: [],
                level_ids: [],
                faculty_ids: [],
                search_by_name: "",
                tag: [],
                package_types: ["MEMBERSHIP"],
                min_percentage_completed: 0,
                max_percentage_completed: 0,
            },
            {
                params: {
                    instituteId: instituteId,
                    page: 0,
                    size: 50,
                    sort: "createdAt,desc",
                },
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        const content: MembershipPlan[] = response.data?.content || [];

        // API returns one row per package_session — deduplicate by package id
        const seen = new Set<string>();
        return content.filter((plan) => {
            if (seen.has(plan.id)) return false;
            seen.add(plan.id);
            return true;
        });
    } catch (error) {
        console.error("[MembershipPlanService] Error fetching membership plans:", error);
        if (axios.isAxiosError(error)) {
            console.error("[MembershipPlanService] Axios error details:", {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
            });
        }
        throw error;
    }
};
