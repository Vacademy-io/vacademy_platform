import { getPublicUrl } from "@/services/upload_file";

// Utility functions for YouTube URL handling
export function isYouTubeUrl(url: string): boolean {
    if (!url) return false;
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
}

export function getYouTubeVideoId(url: string): string | null {
    if (!url) return null;
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

export function convertToYouTubeEmbedUrl(url: string): string {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) return url;
    
    return `https://www.youtube.com/embed/${videoId}`;
}

interface SubjectType {
    id: string;
    subject_name: string;
    subject_code: string;
    credit: number;
    thumbnail_id: string | null;
    created_at: string | null;
    updated_at: string | null;
    subject_order?: number;
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
    sessions: Array<{
        level_with_details: Array<{
            id: string;
            name: string;
            duration_in_days: number;
            subjects: SubjectType[];
        }>;
        session_dto: {
            id: string;
            session_name: string;
            status: string;
            start_date: string;
        };
    }>;
}

const createDefaultSubject = (): SubjectType => ({
    id: "DEFAULT",
    subject_name: "DEFAULT",
    subject_code: "DEFAULT",
    credit: 0,
    thumbnail_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
});

const tryGetPublicUrl = async (
    mediaId: string | null | undefined
): Promise<string> => {
    if (!mediaId || mediaId.trim() === "") return "";
    try {
        const url = await getPublicUrl(mediaId);
        return url || "";
    } catch {
        return "";
    }
};

function isJson(str: string): boolean {
    try {
        const parsed = JSON.parse(str);
        return typeof parsed === "object" && parsed !== null;
    } catch {
        return false;
    }
}

export const transformApiDataToCourseData = async (
    apiData: any // Use any or the correct type
) => {
    if (!apiData) return null;
    try {
        const courseMediaImage = isJson(apiData.course.course_media_id)
            ? JSON.parse(apiData.course.course_media_id)
            : apiData.course.course_media_id;

        const [coursePreviewImageMediaId, courseBannerMediaId] =
            await Promise.all([
                tryGetPublicUrl(apiData.course.course_preview_image_media_id),
                tryGetPublicUrl(apiData.course.course_banner_media_id),
            ]);

        let courseMediaPreview = "";
        // Only try to get media URL if course_media_id is not empty
        if (apiData.course.course_media_id && apiData.course.course_media_id.trim() !== "") {
            // Check if it's a direct YouTube URL
            if (isYouTubeUrl(apiData.course.course_media_id)) {
                courseMediaPreview = apiData.course.course_media_id;
            } else if (
                isJson(apiData.course.course_media_id) &&
                courseMediaImage.type === "youtube"
            ) {
                courseMediaPreview = courseMediaImage.id || "";
            } else {
                const mediaId = isJson(apiData.course.course_media_id)
                    ? courseMediaImage.id
                    : apiData.course.course_media_id;
                
                // Only call getPublicUrl if mediaId is not empty
                if (mediaId && mediaId.trim() !== "") {
                    courseMediaPreview = await getPublicUrl(mediaId);
                }
            }
        }

        // PATCH: handle tags as string or array
        let tags: string[] = [];
        if (Array.isArray(apiData.course.tags)) {
            tags = apiData.course.tags;
        } else if (typeof apiData.course.tags === "string") {
            tags = apiData.course.tags.split(",").map((tag: string) => tag.trim());
        }

        return {
            id: apiData.course.id,
            title: apiData.course.package_name,
            description: apiData.course.course_html_description || "",
            tags,
            imageUrl: coursePreviewImageMediaId || "", // Use the preview image as the main image
            courseStructure: apiData.course.course_depth,
            whatYoullLearn: apiData.course.why_learn,
            whyLearn: apiData.course.why_learn,
            whoShouldLearn: apiData.course.who_should_learn,
            aboutTheCourse: apiData.course.about_the_course,
            packageName: apiData.course.package_name,
            status: apiData.course.status,
            isCoursePublishedToCatalaouge:
                apiData.course.is_course_published_to_catalaouge,
            coursePreviewImageMediaId,
            courseBannerMediaId,
            courseMediaId: courseMediaPreview,
            courseHtmlDescription: apiData.course.course_html_description,
            instructors: [], // This should be populated from your API if available
            sessions: apiData.sessions.map((session: any) => ({
                levelDetails: session.level_with_details.map((level: any) => {
                    // For course structure 4, add a default subject if no subjects exist
                    let subjects = level.subjects;
                    if (apiData.course.course_depth === 4) {
                        if (!subjects || subjects.length === 0) {
                            subjects = [createDefaultSubject()];
                        }
                    }

                    return {
                        id: level.id,
                        name: level.name,
                        duration_in_days: level.duration_in_days,
                        subjects: subjects.map((subject: any) => ({
                            id: subject.id,
                            subject_name: subject.subject_name,
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
                    session_name: session.session_dto.session_name,
                    status: session.session_dto.status,
                    start_date: session.session_dto.start_date,
                },
            })),
        };
    } catch (error) {
        console.error("Error transforming course data:", error, apiData);
        return null;
    }
};
