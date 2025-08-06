import axios from "axios";
import { BASE_URL } from "@/constants/urls";
import { useInstituteDetailsStore } from "@/stores/study-library/useInstituteDetails";

// Types for API responses
export interface InstituteSearchResult {
    institute_name: string;
    id: string;
}

export interface InstituteDetails {
    institute_name: string;
    id: string;
    country: string;
    state: string;
    city: string;
    address: string;
    pin_code: string;
    phone: string;
    email: string;
    website_url: string;
    institute_logo_file_id: string;
    institute_theme_code: string;
    language: string;
    description: string;
    type: string;
    held_by: string;
    founded_date: string;
    module_request_ids: string[];
    sub_modules: Array<{
        module: string;
        sub_module: string;
        sub_module_description: string;
    }>;
    sessions: Array<{
        id: string;
        session_name: string;
        status: string;
        start_date: string;
    }>;
    batches_for_sessions: Array<{
        id: string;
        level: {
            id: string;
            level_name: string;
            duration_in_days: number;
            thumbnail_id: string;
        };
        session: {
            id: string;
            session_name: string;
            status: string;
            start_date: string;
        };
        start_time: string;
        status: string;
        package_dto: {
            id: string;
            package_name: string;
            thumbnail_file_id: string;
            is_course_published_to_catalaouge: boolean;
            course_preview_image_media_id: string;
            course_banner_media_id: string;
            course_media_id: string;
            why_learn_html: string;
            who_should_learn_html: string;
            about_the_course_html: string;
            tags: string[];
            course_depth: number;
            course_html_description_html: string;
        };
        group: {
            id: string;
            group_name: string;
            parent_group: {
                id: string;
                groupName: string;
                parentGroup: string;
                isRoot: boolean;
                updatedAt: string;
                createdAt: string;
                groupValue: string;
            };
            is_root: boolean;
            group_value: string;
        };
    }>;
    levels: Array<{
        id: string;
        level_name: string;
        duration_in_days: number;
        thumbnail_id: string;
    }>;
    genders: string[];
    student_statuses: string[];
    subjects: Array<{
        id: string;
        subject_name: string;
        subject_code: string;
        credit: number;
        thumbnail_id: string;
        created_at: string;
        updated_at: string;
        subject_order: number;
    }>;
    session_expiry_days: number[];
    package_groups: Array<{
        group: {
            id: string;
            group_name: string;
            parent_group: {
                id: string;
                groupName: string;
                parentGroup: string;
                isRoot: boolean;
                updatedAt: string;
                createdAt: string;
                groupValue: string;
            };
            is_root: boolean;
            group_value: string;
        };
        package_dto: {
            id: string;
            package_name: string;
            thumbnail_file_id: string;
            is_course_published_to_catalaouge: boolean;
            course_preview_image_media_id: string;
            course_banner_media_id: string;
            course_media_id: string;
            why_learn_html: string;
            who_should_learn_html: string;
            about_the_course_html: string;
            tags: string[];
            course_depth: number;
            course_html_description_html: string;
        };
        id: string;
    }>;
    letter_head_file_id: string;
    tags: string[];
    setting: string;
    cover_image_file_id: string;
    cover_text_json: string;
}

export interface InstituteSettings {
    allowLearnerSignup: boolean;
    allowTeacherSignup: boolean;
    learnersCanCreateCourses: boolean;
}

export interface RegisterUserRequest {
    user: {
        id?: string;
        username: string;
        email: string;
        full_name: string;
        address_line?: string;
        city?: string;
        region?: string;
        pin_code?: string;
        mobile_number?: string;
        date_of_birth?: string;
        gender?: string;
        password?: string;
        profile_pic_file_id?: string;
        roles: string[];
        root_user: boolean;
    };
    institute_id: string;
    subject_id?: string;
    vendor_id?: string;
    learner_package_session_enroll: null;
}

export interface RegisterUserResponse {
    accessToken: string;
    refreshToken: string;
}

export interface UserDetailsByEmailResponse {
    id: string;
    username: string;
    email: string;
    full_name: string;
    address_line?: string;
    city?: string;
    region?: string | null;
    pin_code?: string;
    mobile_number?: string;
    date_of_birth?: string | null;
    gender?: string;
    password?: string;
    profile_pic_file_id?: string;
    roles: string[];
    root_user: boolean;
}

export const useInstituteQuery = ({ instituteId }: { instituteId: string }) => {
    const setInstituteDetails = useInstituteDetailsStore(
        (state) => state.setInstituteDetails
    );

    return {
        queryKey: ["GET_INIT_INSTITUTE", instituteId],
        queryFn: async () => {
            const data = await getInstituteDetails(instituteId);
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            setInstituteDetails(data);
            return data;
        },
        staleTime: 3600000,
    };
};

// API functions
export const searchInstitute = async (
    searchName: string
): Promise<InstituteSearchResult[]> => {
    try {
        const response = await axios.get<InstituteSearchResult[]>(
            `${BASE_URL}/admin-core-service/public/institute/v1/search`,
            {
                params: { searchName },
                headers: {
                    accept: "*/*",
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error searching institutes:", error);
        throw new Error("Failed to search institutes");
    }
};

export const getInstituteDetails = async (
    instituteId: string
): Promise<InstituteDetails> => {
    try {
        const response = await axios.get<InstituteDetails>(
            `${BASE_URL}/admin-core-service/public/institute/v1/details/${instituteId}`,
            {
                headers: {
                    accept: "*/*",
                },
            }
        );
        return response.data;
    } catch (error) {
        throw new Error("Failed to fetch institute details");
    }
};

export const registerUser = async (
    userData: RegisterUserRequest
): Promise<RegisterUserResponse> => {
    try {
        const response = await axios.post<RegisterUserResponse>(
            `${BASE_URL}/auth-service/learner/v1/register`,
            userData,
            {
                headers: {
                    accept: "*/*",
                    "Content-Type": "application/json",
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error registering user:", error);
        throw new Error("Failed to register user");
    }
};

export const getUserDetailsByEmail = async (
    email: string
): Promise<UserDetailsByEmailResponse> => {
    try {
        const response = await axios.post(
            `${BASE_URL}/auth-service/open/user-details/by-email?emailId=${encodeURIComponent(email)}`,
            {},
            {
                headers: {
                    accept: "*/*",
                    "content-type": "application/json",
                },
            }
        );
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            throw new Error("USER_NOT_FOUND");
        }
        throw error;
    }
};

// Utility function to parse institute settings
export const parseInstituteSettings = (
    settingsString: string
): InstituteSettings => {
    try {
        // Handle null, undefined, or empty string
        if (!settingsString || settingsString.trim() === "") {
            return {
                allowLearnerSignup: true,
                allowTeacherSignup: false,
                learnersCanCreateCourses: false,
            };
        }

        const settings = JSON.parse(settingsString);
        // Handle case where parsed result is null or not an object
        if (!settings || typeof settings !== "object") {
            return {
                allowLearnerSignup: true,
                allowTeacherSignup: false,
                learnersCanCreateCourses: false,
            };
        }

        // Extract permissions from the nested structure
        let allowLearnersToCreateCourses = false;
        if (settings.setting && typeof settings.setting === "object") {
            if (
                settings.setting.COURSE_SETTING &&
                settings.setting.COURSE_SETTING.data &&
                settings.setting.COURSE_SETTING.data.permissions
            ) {
                const permissions =
                    settings.setting.COURSE_SETTING.data.permissions;
                allowLearnersToCreateCourses =
                    permissions.allowLearnersToCreateCourses ?? false;
            }
        }
        // For backward compatibility, also check direct properties
        const allowLearnerSignup = settings.allowLearnerSignup ?? true;
        const allowTeacherSignup = settings.allowTeacherSignup ?? false;
        const learnersCanCreateCourses =
            allowLearnersToCreateCourses ||
            (settings.learnersCanCreateCourses ?? false);
        return {
            allowLearnerSignup,
            allowTeacherSignup,
            learnersCanCreateCourses,
        };
    } catch (error) {
        return {
            allowLearnerSignup: true,
            allowTeacherSignup: false,
            learnersCanCreateCourses: false,
        };
    }
};

// Utility function to handle post-signup authentication and redirect
export const handlePostSignupAuth = async (
    accessToken: string,
    refreshToken: string,
    instituteId: string,
    navigate: any,
    isModalSignup?: boolean,
    type?: string,
    courseId?: string
) => {
    try {
        // Import required functions
        const { Preferences } = await import("@capacitor/preferences");
        const { TokenKey } = await import("@/constants/auth/tokens");
        const { getTokenDecodedData } = await import(
            "@/lib/auth/sessionUtility"
        );
        const { fetchAndStoreInstituteDetails } = await import(
            "@/services/fetchAndStoreInstituteDetails"
        );
        const { fetchAndStoreStudentDetails } = await import(
            "@/services/studentDetails"
        );
        const { toast } = await import("sonner");

        // Store tokens in storage
        await Preferences.set({
            key: TokenKey.accessToken,
            value: accessToken,
        });
        await Preferences.set({
            key: TokenKey.refreshToken,
            value: refreshToken,
        });
        await Preferences.set({ key: "instituteId", value: instituteId });

        // Decode token to get user ID
        const decodedData = getTokenDecodedData(accessToken);
        const userId = decodedData?.user;

        if (!userId) {
            throw new Error("Invalid user data in token");
        }

        // Fetch and store institute details
        const instituteDetails = await fetchAndStoreInstituteDetails(
            instituteId,
            userId
        );

        // Fetch and store student details
        await fetchAndStoreStudentDetails(instituteId, userId);

        // Show success message
        toast.success("Successfully signed up and logged in!");

        // Determine redirect URL based on context
        let redirectUrl = "/dashboard";

        if (type === "courseDetailsPage" && courseId) {
            redirectUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
        } else if (type === "courseDetailsPage") {
            redirectUrl = "/study-library/courses";
        }

        // Open in new tab if signup originated from course-related pages or if type is courseDetailsPage
        if (type === "courseDetailsPage" || (type && type !== "mainSignup")) {
            window.open(redirectUrl, "_blank");
        }
        // Only navigate to dashboard if this is NOT a modal signup (i.e., main signup page)
        if (!isModalSignup || type === "mainSignup") {
            navigate({ to: redirectUrl });
        }
    } catch (error) {
        console.error("Error in post-signup authentication:", error);
        // If there's an error, still redirect to login as fallback
        navigate({ to: "/login" });
    }
};
