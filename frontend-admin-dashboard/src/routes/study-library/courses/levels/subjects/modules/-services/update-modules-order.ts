import { useMutation, useQueryClient } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { UPDATE_MODULE_ORDER } from "@/constants/urls";
import { orderModulePayloadType } from "@/routes/study-library/courses/-types/order-payload";

export const useUpdateModuleOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ updatedModules }: { updatedModules: orderModulePayloadType[] }) => {
            const payload = updatedModules;
            return authenticatedAxiosInstance.post(`${UPDATE_MODULE_ORDER}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_MODULES_WITH_CHAPTERS"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SUBJECTS_PROGRESS"] });
        },
    });
};
