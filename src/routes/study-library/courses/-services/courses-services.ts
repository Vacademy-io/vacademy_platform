import { getInstituteId } from '@/constants/helper';
import { AllCourseFilters } from '../-components/course-material';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { COURSE_CATALOG_TEACHER_URL, COURSE_CATALOG_URL } from '@/constants/urls';

export const fetchCourseDetails = async (courseId: string) => {
    const instituteId = getInstituteId();
    // Replace with your actual API endpoint
    const response = await fetch(`/api/institutes/${instituteId}/courses/${courseId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch course details');
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
        const requestBody = {
            status: data.status ?? ['ACTIVE'],
            level_ids: data.level_ids ?? [],
            faculty_ids: data.faculty_ids ?? [],
            package_types: [] as string[],
            search_by_name: data.search_by_name ? data.search_by_name : null,
            tag: data.tag ?? [],
            created_by_user_id: null as string | null,
            min_percentage_completed:
                typeof data.min_percentage_completed === 'number'
                    ? data.min_percentage_completed
                    : 0,
            max_percentage_completed:
                typeof data.max_percentage_completed === 'number'
                    ? data.max_percentage_completed
                    : 100,
            sort_columns: data.sort_columns ?? {},
            type: null as string | null,
            package_ids: data.package_ids ?? [],
            package_session_ids: data.package_session_ids ?? [],
            ...(data.package_session_filter === 'PARENTS_ONLY' ||
            data.package_session_filter === 'CHILDREN_ONLY'
                ? { package_session_filter: data.package_session_filter }
                : {}),
        };

        const response = await authenticatedAxiosInstance({
            method: 'POST',
            url: `${COURSE_CATALOG_URL}`,
            params: {
                instituteId,
                page,
                size: pageSize,
            },
            data: requestBody,
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
            method: 'POST',
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
