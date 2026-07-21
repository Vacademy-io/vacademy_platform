import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { AI_COURSE_ASSIST_TEXT, AI_COURSE_ASSIST_IMAGE } from '@/constants/urls';

// Flat pricing — mirrors _TEXT_COST/_IMAGE_COST in ai_service course_assist.py.
export const AI_TEXT_CREDIT_COST = 1;
export const AI_IMAGE_CREDIT_COST = 5;

export type AssistTextField = 'description' | 'learningOutcome' | 'aboutCourse' | 'targetAudience';
export type AssistImageKind = 'preview' | 'banner' | 'media';

export interface AssistTextPayload {
    prompt: string;
    field?: AssistTextField;
    course_name?: string;
    existing_html?: string;
}

export interface AssistTextResult {
    html: string;
    model: string;
    credits_charged: number;
}

export interface AssistImagePayload {
    prompt: string;
    kind?: AssistImageKind;
    course_name?: string;
    aspect_ratio?: string;
    /** Institute branding (opt-in): hex palette hints + public logo URL the
     * image model receives as a reference input. */
    brand_colors?: string[];
    logo_url?: string;
}

export interface AssistImageResult {
    image_base64: string;
    mime_type: string;
    model: string;
    credits_charged: number;
}

export const generateCourseFieldText = async (
    payload: AssistTextPayload
): Promise<AssistTextResult> => {
    const response = await authenticatedAxiosInstance.post(AI_COURSE_ASSIST_TEXT(), payload);
    return response.data;
};

export const generateCourseFieldImage = async (
    payload: AssistImagePayload
): Promise<AssistImageResult> => {
    const response = await authenticatedAxiosInstance.post(AI_COURSE_ASSIST_IMAGE(), payload);
    return response.data;
};

/** The image comes back base64 so it can ride the normal media-service upload
 * flow (fileId + public URL) exactly like a manually chosen file. */
export const assistImageToFile = (result: AssistImageResult, baseName: string): File => {
    const binary = atob(result.image_base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const extension = result.mime_type.split('/')[1] || 'png';
    return new File([bytes], `${baseName}.${extension}`, { type: result.mime_type });
};
