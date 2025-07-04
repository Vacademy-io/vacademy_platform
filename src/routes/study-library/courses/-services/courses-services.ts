import { getInstituteId } from "@/constants/helper";

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
