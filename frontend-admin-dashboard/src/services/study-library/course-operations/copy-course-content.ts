import { useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { COPY_COURSE_CONTENT } from '@/constants/urls';

export type CopyContentMode = 'VALUE' | 'REFERENCE';

export interface CopyCourseContentRequest {
    sourcePackageSessionId: string;
    targetPackageSessionIds: string[];
    /**
     * VALUE     => deep clone (independent copies, new ids).
     * REFERENCE => share rows (same content visible in both courses; edits propagate).
     * Defaults to VALUE on the backend if omitted.
     */
    mode?: CopyContentMode;
}

export interface CopyCourseContentResponse {
    copiedSubjects: number;
    copiedModules: number;
    copiedChapters: number;
    copiedSlides: number;
    warnings: string[];
}

/**
 * Wizard-time deep clone of one institute batch's content into the freshly-created
 * course's batches. Backend enforces same-depth between source and target courses.
 */
export const useCopyCourseContent = () => {
    const queryClient = useQueryClient();

    return useMutation<CopyCourseContentResponse, unknown, CopyCourseContentRequest>({
        mutationFn: async (payload) => {
            const response = await authenticatedAxiosInstance.post<CopyCourseContentResponse>(
                COPY_COURSE_CONTENT,
                payload
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_STUDY_LIBRARY'] });
            queryClient.invalidateQueries({ queryKey: ['GET_MODULES_WITH_CHAPTERS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS'] });
        },
    });
};
