import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SubjectType } from "@/stores/study-library/use-study-library-store";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { UPDATE_SUBJECT } from "@/constants/urls";

export const useUpdateSubject = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            subjectId,
            updatedSubject,
        }: {
            subjectId: string;
            updatedSubject: SubjectType;
        }) => {
            const payload = {
                id: subjectId,
                subject_name: updatedSubject.subject_name,
                subject_code: updatedSubject.subject_code,
                credit: updatedSubject.credit,
                thumbnail_id: updatedSubject.thumbnail_id,
                created_at: updatedSubject.created_at,
                updated_at: new Date().toISOString(),
            };
            return authenticatedAxiosInstance.put(
                `${UPDATE_SUBJECT}?subjectId=${subjectId}`,
                payload,
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SUBJECTS_PROGRESS"] });
        },
    });
};
