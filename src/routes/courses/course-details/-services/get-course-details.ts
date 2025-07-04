import { GET_ALL_COURSE_DETAILS, GET_COURSE_DETAILS } from "@/constants/urls";
import axios from "axios";

export const getCourseDetailsData = async ({
    packageId,
}: {
    packageId: string;
}) => {
    const response = await axios({
        method: "GET",
        url: GET_COURSE_DETAILS,
        params: {
            packageId,
        },
    });
    return response?.data;
};
export const handleGetCourseDetails = ({
    packageId,
}: {
    packageId: string;
}) => {
    return {
        queryKey: ["GET_COURSE_DETAILS", packageId],
        queryFn: () => getCourseDetailsData({ packageId }),
        staleTime: 60 * 60 * 1000,
    };
};

export const getAllCourseDetailsData = async ({
    instituteId,
}: {
    instituteId: string;
}) => {
    const response = await axios({
        method: "GET",
        url: GET_ALL_COURSE_DETAILS,
        params: {
            instituteId,
        },
    });
    return response?.data;
};
export const handleGetAllCourseDetails = ({
    instituteId,
}: {
    instituteId: string;
}) => {
    return {
        queryKey: ["GET_ALL_COURSE_DETAILS", instituteId],
        queryFn: () => getAllCourseDetailsData({ instituteId }),
        staleTime: 60 * 60 * 1000,
    };
};
