import {
    GET_BATCH_REPORT,
    GET_LEADERBOARD_DATA,
    GET_LEARNERS_REPORT,
    CHAPTER_WISE_BATCH_REPORT,
    SUBJECT_WISE_BATCH_REPORT,
    CHAPTER_WISE_LEARNERS_REPORT,
    SUBJECT_WISE_LEARNERS_REPORT,
    SLIDE_WISE_LEARNERS_REPORT,
    INSTITUTE_SETTING,
    UPDATE_INSTITUTE_SETTING,
    LEARNERS_SETTING,
    UPDATE_LEARNERS_SETTING,
    EXPORT_BATCH_REPORT,
    EXPORT_LEARNERS_REPORT,
    EXPORT_LEARNERS_SUBJECT_REPORT,
    EXPORT_LEARNERS_MODULE_REPORT,
} from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { InstituteSettingResponse } from "../-types/types";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

export const fetchBatchReport = async (data: {
    start_date: string;
    end_date: string;
    package_session_id: string;
}) => {
    const response = await authenticatedAxiosInstance.post(GET_BATCH_REPORT, data, {
        headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
        },
    });
    return response.data;
};
export const fetchLearnersReport = async (data: {
    start_date: string;
    end_date: string;
    package_session_id: string;
    user_id: string;
}) => {
    const response = await authenticatedAxiosInstance.post(GET_LEARNERS_REPORT, data, {
        headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
        },
    });
    return response.data;
};
export const fetchLeaderboardData = async (data: {
    body: {
        start_date: string;
        end_date: string;
        package_session_id: string;
    };
    param: { pageNo: number; pageSize: number };
}) => {
    const response = await authenticatedAxiosInstance.post(GET_LEADERBOARD_DATA, data.body, {
        params: data.param,
        headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
        },
    });
    return response.data;
};

export const fetchChapterWiseProgress = async (data: {
    packageSessionId: string;
    moduleId: string;
}) => {
    try {
        const response = await authenticatedAxiosInstance.get(CHAPTER_WISE_BATCH_REPORT, {
            params: data,
            headers: {
                Accept: "*/*",
            },
        });

        return response.data;
    } catch (error) {
        return null;
    }
};
export const fetchLearnersChapterWiseProgress = async (data: {
    userId: string;
    moduleId: string;
}) => {
    try {
        const response = await authenticatedAxiosInstance.get(CHAPTER_WISE_LEARNERS_REPORT, {
            params: data,
            headers: {
                Accept: "*/*",
            },
        });

        return response.data;
    } catch (error) {
        return null;
    }
};

export const fetchSubjectWiseProgress = async (data: { packageSessionId: string }) => {
    try {
        const response = await authenticatedAxiosInstance.get(SUBJECT_WISE_BATCH_REPORT, {
            params: data,
            headers: {
                Accept: "*/*",
            },
        });

        return response.data;
    } catch (error) {
        return null;
    }
};
export const fetchLearnersSubjectWiseProgress = async (data: {
    packageSessionId: string;
    userId: string;
}) => {
    try {
        const response = await authenticatedAxiosInstance.get(SUBJECT_WISE_LEARNERS_REPORT, {
            params: data,
            headers: {
                Accept: "*/*",
            },
        });

        return response.data;
    } catch (error) {
        return null;
    }
};

export const fetchSlideWiseProgress = async (data: {
    start_date: string;
    end_date: string;
    package_session_id: string;
    user_id: string;
}) => {
    try {
        const response = await authenticatedAxiosInstance.post(SLIDE_WISE_LEARNERS_REPORT, data, {
            headers: {
                Accept: "*/*",
                "Content-Type": "application/json",
            },
        });
        return response.data;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const fetchInstituteSetting = async (instituteId: string) => {
    try {
        const response = await authenticatedAxiosInstance.get(INSTITUTE_SETTING, {
            params: {
                instituteId,
            },
            headers: {
                Accept: "*/*",
            },
        });
        return response.data;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const updateInstituteReportSetting = async (data: InstituteSettingResponse) => {
    try {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const tokenData = getTokenDecodedData(accessToken);
        const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
        const response = await authenticatedAxiosInstance.post(
            `${UPDATE_INSTITUTE_SETTING}/${INSTITUTE_ID}`,
            data,
            {
                headers: {
                    Accept: "*/*",
                    "Content-Type": "application/json",
                },
            },
        );
        return response.data;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const fetchLearnerSetting = async (param: { userId: string; instituteId: string }) => {
    try {
        const response = await authenticatedAxiosInstance.get(LEARNERS_SETTING, {
            params: param,
            headers: {
                Accept: "*/*",
            },
        });
        return response.data;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const updateLearnersReportSetting = async (params: {
    userId: string;
    data: InstituteSettingResponse;
}) => {
    try {
        const response = await authenticatedAxiosInstance.post(
            `${UPDATE_LEARNERS_SETTING}`,
            params.data,
            {
                params: { userId: params.userId },
                headers: {
                    Accept: "*/*",
                    "Content-Type": "application/json",
                },
            },
        );
        return response.data;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const exportBatchReport = async (params: {
    startDate: string;
    endDate: string;
    packageSessionId: string;
    userId: string;
}) => {
    try {
        const response = await authenticatedAxiosInstance.post(
            EXPORT_BATCH_REPORT,
            {
                start_date: params.startDate,
                end_date: params.endDate,
                package_session_id: params.packageSessionId,
                user_id: params.userId,
            },
            {
                responseType: "blob",
                headers: {
                    Accept: "*/*",
                    "Content-Type": "application/json",
                },
            },
        );

        return response.data;
    } catch (error) {
        console.error("Error exporting batch report:", error);
        throw error;
    }
};

export const exportLearnersReport = async (params: {
    startDate: string;
    endDate: string;
    packageSessionId: string;
    userId: string;
}) => {
    try {
        const response = await authenticatedAxiosInstance.post(
            EXPORT_LEARNERS_REPORT,
            {
                start_date: params.startDate,
                end_date: params.endDate,
                package_session_id: params.packageSessionId,
                user_id: params.userId,
            },
            {
                responseType: "blob",
                headers: {
                    Accept: "*/*",
                    "Content-Type": "application/json",
                },
            },
        );

        return response.data;
    } catch (error) {
        console.error("Error exporting batch report:", error);
        throw error;
    }
};

export const exportLearnersSubjectReport = async (params: {
    startDate: string;
    endDate: string;
    packageSessionId: string;
    userId: string;
}) => {
    try {
        const response = await authenticatedAxiosInstance.post(
            EXPORT_LEARNERS_SUBJECT_REPORT,
            {
                start_date: params.startDate,
                end_date: params.endDate,
                package_session_id: params.packageSessionId,
                user_id: params.userId,
            },
            {
                responseType: "blob",
                headers: {
                    Accept: "*/*",
                    "Content-Type": "application/json",
                },
            },
        );

        return response.data;
    } catch (error) {
        console.error("Error exporting batch report:", error);
        throw error;
    }
};

export const exportLearnerModuleProgressReport = async (params: {
    userId: string;
    moduleId: string;
    packageSessionId: string;
}) => {
    try {
        const response = await authenticatedAxiosInstance.post(
            EXPORT_LEARNERS_MODULE_REPORT,
            null,
            {
                responseType: "blob",
                params: {
                    userId: params.userId,
                    moduleId: params.moduleId,
                    packageSessionId: params.packageSessionId,
                },
                headers: {
                    Accept: "application/pdf",
                    "Content-Type": "application/json",
                },
            },
        );

        return response.data;
    } catch (error) {
        console.error("Error exporting learner module progress report:", error);
        throw error;
    }
};
