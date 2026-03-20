import { getInstituteId } from "@/constants/helper";
import { cachedGet } from "@/lib/http/clientCache";

export const fetchCourseDetails = async (courseId: string) => {
    const instituteId = getInstituteId();
    // Replace with your actual API endpoint
    const data = await cachedGet<any>(`/api/institutes/${instituteId}/courses/${courseId}`, { method: 'GET' });
    return data;
};
