import { getPublicUrl } from "@/services/upload_file";

interface CourseMedia {
    type: string; // e.g., 'video', 'image', etc.
    id: string;
}

export interface CourseDetailsJsonDataForInviteLink {
    course: string;
    description: string;
    learningOutcome: string;
    aboutCourse: string;
    targetAudience: string;
    coursePreview: string;
    courseBanner: string;
    courseMedia: CourseMedia;
    coursePreviewBlob: string;
    courseBannerBlob: string;
    courseMediaBlob: string;
    tags: string[];
    showRelatedCourses: boolean;
    includeInstituteLogo: boolean;
    restrictToSameBatch: boolean;
    customHtml: string;
}

export const safeJsonParse = (
    jsonString: string | null | undefined,
    defaultValue: unknown = null
) => {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.warn("Failed to parse JSON:", jsonString, error);
        return defaultValue;
    }
};

export const transformApiDataToCourseDataForInvite = async (
    apiData: CourseDetailsJsonDataForInviteLink
) => {
    // Local cache for fileId -> publicUrl
    const fileUrlCache: Record<string, string> = {};

    async function getUrlOnce(
        fileId: string | null | undefined
    ): Promise<string> {
        if (!fileId) return "";
        if (fileUrlCache[fileId] !== undefined)
            return fileUrlCache[fileId] ?? "";
        const url = (await getPublicUrl(fileId)) ?? "";
        fileUrlCache[fileId] = url;
        return url;
    }

    try {
        const courseMediaPreview =
            apiData.courseMedia?.type === "youtube"
                ? apiData.courseMedia.id
                : await getUrlOnce(apiData.courseMedia?.id);

        const coursePreviewImageMediaPreview = await getUrlOnce(
            apiData.coursePreview
        );
        const courseBannerMediaPreview = await getUrlOnce(apiData.courseBanner);

        console.log("apiData", apiData);

        return {
            course: apiData.course,
            description: apiData.description, // Consider stripping HTML if needed
            tags: apiData.tags ?? [],
            imageUrl: "", // Placeholder; update if needed
            whatYoullLearn: apiData.learningOutcome,
            whyLearn: apiData.learningOutcome,
            whoShouldLearn: apiData.targetAudience,
            aboutTheCourse: apiData.aboutCourse,
            coursePreviewImageMediaId: apiData.coursePreview,
            courseBannerMediaId: apiData.courseBanner,
            courseMediaId: {
                type: apiData.courseMedia?.type ?? "",
                id: apiData.courseMedia?.id ?? "",
            },
            coursePreviewImageMediaPreview,
            courseBannerMediaPreview,
            courseMediaPreview: courseMediaPreview ?? "",
            showRelatedCourses: apiData.showRelatedCourses,
            includeInstituteLogo: apiData.includeInstituteLogo,
            restrictToSameBatch: apiData.restrictToSameBatch,
            customHtml: apiData.customHtml,
        };
    } catch (error) {
        console.error("Error getting public URLs:", error);
        return null;
    }
};
