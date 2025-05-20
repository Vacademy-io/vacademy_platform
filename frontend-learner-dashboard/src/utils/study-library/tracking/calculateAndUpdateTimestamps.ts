// src/utils/study-library/tracking/calculateAndUpdateTimestamps.ts
import { v4 as uuidv4 } from 'uuid';
import { formatVideoTime } from './formatVideoTime';
import { ActivitySchema } from '@/schemas/study-library/youtube-video-tracking-schema';
import { z } from 'zod';


export const calculateAndUpdateTimestamps = (activity: z.infer<typeof ActivitySchema>) => {
    const totalTimestampDuration = activity.timestamps.reduce((sum: number, timestamp: {
        start: number;
        end: number;
    }) => {
        const startSeconds = timestamp.start;
        const endSeconds = timestamp.end;
        return sum + (endSeconds - startSeconds);
    }, 0);

    const activityDuration = parseInt(activity.duration)*1000;

    if (activityDuration > totalTimestampDuration && activity.current_start_time) {
        const remainingDuration = activityDuration - totalTimestampDuration;
        const endTimeInEpoch: number = activity.current_start_time_in_epoch + remainingDuration;
        
      

        const newTimestamp = {
            id: uuidv4(),
            start_time: formatVideoTime(activity.current_start_time_in_epoch/1000),
            end_time: formatVideoTime(endTimeInEpoch/1000),
            start: activity.current_start_time_in_epoch,
            end: endTimeInEpoch
        };

        return {
            ...activity,
            timestamps: [...activity.timestamps, newTimestamp]
        };
    }

    return activity;
};