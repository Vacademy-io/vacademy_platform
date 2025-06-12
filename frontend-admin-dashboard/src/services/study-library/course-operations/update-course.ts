// services/study-library/course-operations/update-course.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { AddCourseData } from "@/components/common/study-library/add-course/add-course-form";
import { UPDATE_COURSE } from "@/constants/urls";

export const useUpdateCourse = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            courseId,
            requestData,
        }: {
            requestData: AddCourseData;
            courseId?: string;
        }) => {
            const payload = {
                id: courseId,
                package_name: requestData.course_name,
                thumbnail_file_id: requestData.thumbnail_file_id,
            };

            return authenticatedAxiosInstance.put(`${UPDATE_COURSE}/${courseId}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SUBJECTS_PROGRESS"] });
            queryClient.invalidateQueries({ queryKey: ["GET_SESSION_DATA"] });
            queryClient.invalidateQueries({ queryKey: ["GET_BATCHES"] });
        },
    });
};
