import { SUBMIT_MARKS } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";

interface SubimtRequest {
    set_id: string;
    file_id: string;
    data_json: string;
    request: {
        section_id: string;
        question_id: string;
        status: string;
        marks: number;
    }[];
}

export const submitEvlauationMarks = async (
    assessmentId: string,
    instituteId: string,
    attemptId: string,
    data: SubimtRequest,
) => {
    const response = await authenticatedAxiosInstance({
        method: "POST",
        url: `${SUBMIT_MARKS}`,
        params: {
            assessmentId,
            instituteId,
            attemptId,
        },
        data,
    });
    return response?.data;
};
