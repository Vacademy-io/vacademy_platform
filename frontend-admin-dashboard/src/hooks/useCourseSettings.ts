import { useCourseSettingsContext } from '@/providers/course-settings-provider';

export const useCourseSettings = () => {
    // Simply return the context data - now with caching and refresh functionality!
    return useCourseSettingsContext();
};
