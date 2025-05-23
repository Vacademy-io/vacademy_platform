import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SubjectType } from "@/stores/study-library/use-study-library-store";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { ADD_SUBJECT } from "@/constants/urls";

export const useAddSubject = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            subject,
            packageSessionIds,
        }: {
            subject: SubjectType;
            packageSessionIds: string;
        }) => {
            const payload = {
                id: subject.id,
                subject_name: subject.subject_name,
                subject_code: subject.subject_code,
                credit: subject.credit,
                thumbnail_id: subject.thumbnail_id,
                created_at: "",
                updated_at: "",
            };

            return authenticatedAxiosInstance.post(
                `${ADD_SUBJECT}?commaSeparatedPackageSessionIds=${packageSessionIds}`,
                payload,
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SUBJECTS_PROGRESS"] });
            queryClient.invalidateQueries({ queryKey: ["GET_MODULES_WITH_CHAPTERS"] });
        },
    });
};
