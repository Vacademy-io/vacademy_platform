// calculateAndUpdatePageViews.ts
import { v4 as uuidv4 } from 'uuid';
import { ActivitySchema } from '@/schemas/study-library/pdf-tracking-schema';
import { z } from 'zod';

export const calculateAndUpdatePageViews = (activity: z.infer<typeof ActivitySchema>) => {
    const activityDuration = parseInt(activity.duration);
    const totalPageViewsDuration = activity.page_views.reduce((sum, view) => sum + view.duration, 0);

    if (activityDuration > totalPageViewsDuration && activity.current_page !== undefined && activity.current_page_start_time_in_millis) {
        const remainingDuration = activityDuration - totalPageViewsDuration;
        const endTimeInMillis = activity.current_page_start_time_in_millis + (remainingDuration * 1000);

        const newPageView = {
            id: uuidv4(),
            page: activity.current_page,
            duration: remainingDuration,
            start_time: new Date(activity.current_page_start_time_in_millis).toISOString(),
            end_time: new Date(endTimeInMillis).toISOString(),
            start_time_in_millis: activity.current_page_start_time_in_millis,
            end_time_in_millis: endTimeInMillis
        };

        return {
            ...activity,
            page_views: [...activity.page_views, newPageView]
        };
    }

    return activity;
};