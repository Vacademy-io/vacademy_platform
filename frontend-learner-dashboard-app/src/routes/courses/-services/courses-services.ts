import { getInstituteId } from "@/constants/helper";
import { cachedGet } from "@/lib/http/clientCache";
// import { INSTITUTE_ID } from "@/constants/urls";
// Preferences-based institute resolution has been moved to domain routing

export const fetchCourseDetails = async (courseId: string) => {
    const instituteId = getInstituteId();
    // Replace with your actual API endpoint
    const data = await cachedGet(`/api/institutes/${instituteId}/courses/${courseId}`, { method: 'GET' });
    return data;
};

// Legacy institute resolution helpers removed in favor of domain routing (/resolve)
