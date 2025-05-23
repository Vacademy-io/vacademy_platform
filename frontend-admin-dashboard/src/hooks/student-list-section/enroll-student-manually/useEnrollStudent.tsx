// hooks/students/useEnrollStudent.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollStudent } from "@/services/student-list-section/enroll-manually";
import { EnrollStudentRequest } from "@/types/students/type-enroll-student-manually";

export const useEnrollStudent = () => {
    const queryClient = useQueryClient();

    return useMutation<string, Error, EnrollStudentRequest>({
        mutationFn: enrollStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["students"] });
        },
    });
};
