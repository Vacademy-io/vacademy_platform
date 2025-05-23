import { useQuery } from "@tanstack/react-query";
import { GET_LEARNERS_DETAILS } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";

// Define the response type
interface User {
    full_name: string;
    user_id: string;
}

// If the response is an array of users
export type UserResponse = User[];

// Fetch function using Axios
const fetchLearnerDetails = async (
    packageSessionId: string,
    instituteId: string,
): Promise<UserResponse> => {
    const response = await authenticatedAxiosInstance.get(GET_LEARNERS_DETAILS, {
        params: { packageSessionId, instituteId },
        headers: { accept: "*/*" },
    });
    return response.data;
};

// Custom hook using React Query
export const useLearnerDetails = (packageSessionId: string, instituteId: string) => {
    return useQuery({
        queryKey: ["learnerDetails", packageSessionId, instituteId],
        queryFn: () => fetchLearnerDetails(packageSessionId, instituteId),
        enabled: !!packageSessionId && !!instituteId, // Only run if params are valid
    });
};
