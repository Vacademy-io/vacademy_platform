import { SubjectType } from '@/stores/study-library/use-study-library-store';
import { getPublicUrl } from '@/services/upload_file';
import { convertCapitalToTitleCase } from '@/lib/utils';

type DataItem = {
    total_read_time_minutes: number | null;
    slide_count: number;
    source_type: string;
};

export interface Instructor {
    id: string;
    username: string;
    email: string;
    full_name: string;
    address_line: string | null;
    city: string | null;
    region: string | null;
    pin_code: string | null;
    mobile_number: string | null;
    date_of_birth: string | null;
    gender: string | null;
    password: string | null;
    profile_pic_file_id: string | null;
    roles: string[];
    root_user: boolean;
}

export interface Session {
    session_dto: {
        id: string;
        session_name: string;
        status: string;
        start_date: string;
        new_session: boolean;
    };
    level_with_details: Array<{
        id: string;
        name: string;
        duration_in_days: number;
        instructors: Instructor[];
        subjects: SubjectType[];
        new_level: boolean;
    }>;
}

interface CourseWithSessionsType {
    course: {
        id: string;
        package_name: string;
        thumbnail_file_id: string;
        status: string;
        is_course_published_to_catalaouge: boolean;
        course_preview_image_media_id: string;
        course_banner_media_id: string;
        course_media_id: string;
        why_learn: string;
        who_should_learn: string;
        about_the_course: string;
        tags: string;
        course_depth: number;
        course_html_description: string;
    };
    sessions: Session[];
}

const createDefaultSubject = (): SubjectType => ({
    id: 'DEFAULT',
    subject_name: 'DEFAULT',
    subject_code: 'DEFAULT',
    credit: 0,
    thumbnail_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
});

function isJson(str: string): boolean {
    try {
        const parsed = JSON.parse(str);
        return typeof parsed === 'object' && parsed !== null;
    } catch {
        return false;
    }
}

export const transformApiDataToCourseData = async (apiData: CourseWithSessionsType) => {
    if (!apiData) return null;

    // Local cache for fileId -> publicUrl
    const fileUrlCache: Record<string, string> = {};
    async function getUrlOnce(fileId: string | null | undefined): Promise<string> {
        if (!fileId) return '';
        if (fileUrlCache[fileId] !== undefined) return fileUrlCache[fileId] ?? '';
        try {
            const url = (await getPublicUrl(fileId)) ?? '';
            fileUrlCache[fileId] = url;
            return url;
        } catch (error) {
            // If media files are missing or GET_PUBLIC_URL fails (e.g., 404),
            // don't fail the entire course-init transform. Just log and fall
            // back to an empty URL so the rest of the course data (sessions,
            // levels, subjects) can still render.
            console.error('Error fetching public URL for fileId', fileId, error);
            fileUrlCache[fileId] = '';
            return '';
        }
    }

    try {
        const courseMediaImage = isJson(apiData.course.course_media_id)
            ? JSON.parse(apiData.course.course_media_id)
            : apiData.course.course_media_id;

        const coursePreviewImageMediaId = await getUrlOnce(
            apiData.course.course_preview_image_media_id ?? ''
        );
        const courseBannerMediaId = await getUrlOnce(apiData.course.course_banner_media_id ?? '');

        let courseMediaPreview = '';
        if (isJson(apiData.course.course_media_id) && courseMediaImage.type === 'youtube') {
            courseMediaPreview = courseMediaImage.id;
        } else {
            courseMediaPreview = await getUrlOnce(
                isJson(apiData.course.course_media_id)
                    ? courseMediaImage.id ?? ''
                    : apiData.course.course_media_id ?? ''
            );
        }

        return {
            id: apiData.course.id,
            title: convertCapitalToTitleCase(apiData.course.package_name),
            description: apiData.course.course_html_description, // Remove HTML tags
            tags: apiData.course.tags?.split(',').map((tag) => tag.trim()) || [],
            imageUrl: '', // Use the preview image as the main image
            courseStructure: apiData.course.course_depth,
            whatYoullLearn: apiData.course.why_learn,
            whyLearn: apiData.course.why_learn,
            whoShouldLearn: apiData.course.who_should_learn,
            aboutTheCourse: apiData.course.about_the_course,
            packageName: convertCapitalToTitleCase(apiData.course.package_name),
            status: apiData.course.status,
            isCoursePublishedToCatalaouge: apiData.course.is_course_published_to_catalaouge,
            coursePreviewImageMediaId: apiData.course.course_preview_image_media_id,
            courseBannerMediaId: apiData.course.course_banner_media_id,
            courseMediaId: {
                type: isJson(apiData.course.course_media_id) ? courseMediaImage.type : '',
                id: isJson(apiData.course.course_media_id) ? courseMediaImage.id : '',
            },
            coursePreviewImageMediaPreview: coursePreviewImageMediaId,
            courseBannerMediaPreview: courseBannerMediaId,
            courseMediaPreview: courseMediaPreview ?? '',
            courseHtmlDescription: apiData.course.course_html_description,
            instructors: [], // This should be populated from your API if available
            sessions: (Array.isArray(apiData.sessions) ? apiData.sessions : []).map((session) => ({
                levelDetails: (Array.isArray(session.level_with_details)
                    ? session.level_with_details
                    : []
                ).map((level) => {
                    // For course structure 4, add a default subject if no subjects exist
                    let subjects = level.subjects;
                    if (apiData.course.course_depth === 4) {
                        if (!subjects || (Array.isArray(subjects) && subjects.length === 0)) {
                            subjects = [createDefaultSubject()];
                        }
                    }

                    return {
                        id: level.id,
                        name: convertCapitalToTitleCase(level.name),
                        duration_in_days: level.duration_in_days,
                        newLevel: level.new_level,
                        instructors: (Array.isArray(level.instructors)
                            ? level.instructors
                            : []
                        ).map((inst) => ({
                            id: inst.id,
                            name: inst.full_name,
                            email: inst.email,
                            profilePicId: inst.profile_pic_file_id,
                            roles: inst.roles,
                        })),
                        subjects: (Array.isArray(subjects) ? subjects : []).map((subject) => ({
                            id: subject.id,
                            subject_name: convertCapitalToTitleCase(subject.subject_name),
                            subject_code: subject.subject_code,
                            credit: subject.credit,
                            thumbnail_id: subject.thumbnail_id,
                            created_at: subject.created_at,
                            updated_at: subject.updated_at,
                            modules: [],
                        })),
                    };
                }),
                sessionDetails: {
                    id: session.session_dto.id,
                    session_name: convertCapitalToTitleCase(session.session_dto.session_name),
                    status: session.session_dto.status,
                    start_date: session.session_dto.start_date,
                    newSession: session.session_dto.new_session,
                },
            })),
        };
    } catch (error) {
        console.error('Error getting public URLs:', error);
        return null;
    }
};

export const transformApiDataToCourseDataForInvite = async (apiData: CourseWithSessionsType) => {
    if (!apiData) return null;

    // Local cache for fileId -> publicUrl
    const fileUrlCache: Record<string, string> = {};
    async function getUrlOnce(fileId: string | null | undefined): Promise<string> {
        if (!fileId) return '';
        if (fileUrlCache[fileId] !== undefined) return fileUrlCache[fileId] ?? '';
        try {
            const url = (await getPublicUrl(fileId)) ?? '';
            fileUrlCache[fileId] = url;
            return url;
        } catch (error) {
            console.error('Error fetching public URL for fileId (invite)', fileId, error);
            fileUrlCache[fileId] = '';
            return '';
        }
    }

    try {
        const courseMediaImage = isJson(apiData.course.course_media_id)
            ? JSON.parse(apiData.course.course_media_id)
            : apiData.course.course_media_id;

        const coursePreviewImageMediaId = await getUrlOnce(
            apiData.course.course_preview_image_media_id ?? ''
        );
        const courseBannerMediaId = await getUrlOnce(apiData.course.course_banner_media_id ?? '');

        let courseMediaPreview = '';
        if (isJson(apiData.course.course_media_id) && courseMediaImage.type === 'youtube') {
            courseMediaPreview = courseMediaImage.id;
        } else {
            courseMediaPreview = await getUrlOnce(
                isJson(apiData.course.course_media_id)
                    ? courseMediaImage.id ?? ''
                    : apiData.course.course_media_id ?? ''
            );
        }

        return {
            id: apiData.course.id,
            title: apiData.course.package_name,
            description: apiData.course.course_html_description, // Remove HTML tags
            tags: apiData.course.tags?.split(',').map((tag) => tag.trim()) || [],
            imageUrl: '', // Use the preview image as the main image
            courseStructure: apiData.course.course_depth,
            whatYoullLearn: apiData.course.why_learn,
            whyLearn: apiData.course.why_learn,
            whoShouldLearn: apiData.course.who_should_learn,
            aboutTheCourse: apiData.course.about_the_course,
            packageName: apiData.course.package_name,
            coursePreviewImageMediaId: apiData.course.course_preview_image_media_id,
            courseBannerMediaId: apiData.course.course_banner_media_id,
            courseMediaId: {
                type: isJson(apiData.course.course_media_id) ? courseMediaImage.type : '',
                id: isJson(apiData.course.course_media_id) ? courseMediaImage.id : '',
            },
            coursePreviewImageMediaPreview: coursePreviewImageMediaId,
            courseBannerMediaPreview: courseBannerMediaId,
            courseMediaPreview: courseMediaPreview ?? '',
        };
    } catch (error) {
        console.error('Error getting public URLs:', error);
        return null;
    }
};

// Function to get instructors by sessionId and levelId
export function getInstructorsBySessionAndLevel(
    sessionsData: Session[],
    sessionId: string,
    levelId: string
) {
    if (!sessionsData) return [];
    for (const session of sessionsData) {
        if (session.session_dto.id === sessionId) {
            for (const level of session.level_with_details) {
                if (level.id === levelId) {
                    return level.instructors.map((inst: Instructor) => ({
                        id: inst.id,
                        name: inst.full_name,
                        email: inst.email,
                        profilePicId: inst.profile_pic_file_id || '',
                    }));
                }
            }
        }
    }
    return [];
}

export function calculateTotalTimeForCourseDuration(data: DataItem[]): {
    hours: number;
    minutes: number;
} {
    if (!data) return { hours: 0, minutes: 0 };
    const totalMinutes = data.reduce((sum, item) => {
        return sum + (item.total_read_time_minutes ?? 0);
    }, 0);

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return { hours, minutes };
}
