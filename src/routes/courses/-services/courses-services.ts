import { getInstituteId } from "@/constants/helper";
import { AllCourseFilters } from "../-components/course-material";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
    COURSE_CATALOG_TEACHER_URL,
    COURSE_CATALOG_URL,
} from "@/constants/urls";

export const fetchCourseDetails = async (courseId: string) => {
    const instituteId = getInstituteId();
    // Replace with your actual API endpoint
    const response = await fetch(
        `/api/institutes/${instituteId}/courses/${courseId}`
    );
    if (!response.ok) {
        throw new Error("Failed to fetch course details");
    }
    return response.json();
};

export const getAllCoursesWithFilters = async (
    page: number,
    pageSize: number,
    instituteId: string | undefined,
    data: AllCourseFilters
) => {
    try {
        const response = await authenticatedAxiosInstance({
            method: "POST",
            url: `${COURSE_CATALOG_URL}`,
            params: {
                instituteId,
                page,
                size: pageSize,
            },
            data,
        });
        return response?.data;
    } catch (error: unknown) {
        throw new Error(`${error}`);
    }
};

export const getAllTeacherCoursesWithFilters = async (
    page: number,
    pageSize: number,
    instituteId: string | undefined,
    data: AllCourseFilters
) => {
    try {
        const response = await authenticatedAxiosInstance({
            method: "POST",
            url: `${COURSE_CATALOG_TEACHER_URL}`,
            params: {
                instituteId,
                page,
                size: pageSize,
            },
            data,
        });
        return response?.data;
    } catch (error: unknown) {
        throw new Error(`${error}`);
    }
};

