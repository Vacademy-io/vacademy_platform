import { useMutation, useQueryClient } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { UPDATE_SUBJECT_ORDER } from "@/constants/urls";
import { orderSubjectPayloadType } from "@/routes/study-library/courses/-types/order-payload";

export const useUpdateSubjectOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ orderedSubjects }: { orderedSubjects: orderSubjectPayloadType[] }) => {
            const payload = orderedSubjects;
            return authenticatedAxiosInstance.put(`${UPDATE_SUBJECT_ORDER}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SUBJECTS_PROGRESS"] });
        },
    });
};
