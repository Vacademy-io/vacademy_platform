import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_LEARNER_PACKAGES_BY_USER_ID } from '@/constants/urls';
import { useQuery } from '@tanstack/react-query';

export interface PackageDetailDTO {
    id: string;
    package_name: string;
    thumbnail_file_id: string | null;
    is_course_published_to_catalaouge: boolean | null;
    course_preview_image_media_id: string | null;
    course_banner_media_id: string | null;
    course_media_id: string | null;
    why_learn_html: string | null;
    who_should_learn_html: string | null;
    about_the_course_html: string | null;
    comma_separeted_tags: string | null;
    course_depth: number;
    course_html_description_html: string | null;
    percentage_completed: number;
    rating: number;
    package_session_id: string | null;
    level_id: string | null;
    level_name: string | null;
    drip_condition_json: any;
    instructors: any[];
    level_ids: string[];
    read_time_in_minutes: number;
    package_type: string;
    is_parent?: boolean;
    parent_id?: string | null;
}

export interface LearnerPackagesResponse {
    content: PackageDetailDTO[];
    pageable: any;
    totalElements: number;
    totalPages: number;
    last: boolean;
    numberOfElements: number;
    size: number;
    number: number;
    sort: any;
    first: boolean;
    empty: boolean;
}

export const useLearnerPackagesQuery = ({
    instituteId,
    userId,
    page = 0,
    size = 10,
    type,
}: {
    instituteId: string;
    userId: string;
    page?: number;
    size?: number;
    type: 'PROGRESS' | 'COMPLETED';
}) => {
    return useQuery<LearnerPackagesResponse>({
        queryKey: ['GET_LEARNER_PACKAGES', instituteId, userId, page, size, type],
        queryFn: async () => {
            const body = {
                status: [],
                level_ids: [],
                faculty_ids: [],
                search_by_name: '',
                tag: [],
                min_percentage_completed: 0,
                max_percentage_completed: 0,
                type: type,
                sort_columns: {
                    created_at: 'DESC',
                },
            };
            const response = await authenticatedAxiosInstance.post(
                GET_LEARNER_PACKAGES_BY_USER_ID,
                body,
                {
                    params: {
                        instituteId,
                        userId,
                        page,
                        size,
                    },
                }
            );
            return response.data;
        },
        staleTime: 60000,
        enabled: !!userId && !!instituteId,
    });
};
