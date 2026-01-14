import { GET_ALL_COURSE_DETAILS, GET_COURSE_DETAILS, GET_COURSE_INIT } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";

export const getCourseDetailsData = async ({
  packageId,
}: {
  packageId: string;
}) => {
  const response = await authenticatedAxiosInstance({
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

/** @deprecated Use getCourseInitData instead - this fetches ALL courses */
export const getAllCourseDetailsData = async ({
  instituteId,
}: {
  instituteId: string;
}) => {
  if (!instituteId) return null;
  const response = await authenticatedAxiosInstance({
    method: "GET",
    url: GET_ALL_COURSE_DETAILS,
    params: {
      instituteId,
    },
  });
  return response?.data;
};

/** @deprecated Use handleGetCourseInit instead - this fetches ALL courses */
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

/**
 * New scalable endpoint - fetches single course details by courseId
 * Returns the same structure as getAllCourseDetailsData but for a single course
 */
export const getCourseInitData = async ({
  courseId,
  instituteId,
}: {
  courseId: string;
  instituteId: string;
}) => {
  if (!courseId || !instituteId) return null;
  const response = await authenticatedAxiosInstance({
    method: "GET",
    url: GET_COURSE_INIT,
    params: {
      courseId,
      instituteId,
    },
  });
  // API returns List<CourseDTOWithDetails>, extract single course
  const data = response?.data;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
};

/**
 * React Query hook config for single course init
 * Use this instead of handleGetAllCourseDetails when you have courseId
 */
export const handleGetCourseInit = ({
  courseId,
  instituteId,
}: {
  courseId: string;
  instituteId: string;
}) => {
  return {
    queryKey: ["GET_COURSE_INIT", courseId, instituteId],
    queryFn: () => getCourseInitData({ courseId, instituteId }),
    staleTime: 60 * 60 * 1000,
    enabled: Boolean(courseId && instituteId),
  };
};
