import { getInstituteId } from "@/constants/helper";
import { GET_SUBDOMAIN_OR_INSTITUTEID } from "@/constants/urls";
import axios from "axios";

export const fetchCourseDetails = async (courseId: string) => {
    const instituteId = getInstituteId();
    // Replace with your actual API endpoint
    const response = await fetch(
        `/api/institutes/${instituteId}/courses/${courseId}`
    );
    if (!response.ok) {
        throw new Error("Failed to fetch course details");
    }
    return response.json();
};

export const getInstituteIdBySubdomain = async ({
    subdomain,
}: {
    subdomain: string;
}) => {
    const response = await axios({
        method: "GET",
        url: GET_SUBDOMAIN_OR_INSTITUTEID,
        params: {
            subdomain,
            instituteId: "",
        },
    });
    return response?.data;
};
export const handleGetInstituteIdBySubdomain = ({
    subdomain,
}: {
    subdomain: string;
}) => {
    return {
        queryKey: ["GET_INSTITUTEID_OR_SUBDOMAIN", subdomain],
        queryFn: () => getInstituteIdBySubdomain({ subdomain }),
        staleTime: 60 * 60 * 1000,
    };
};
