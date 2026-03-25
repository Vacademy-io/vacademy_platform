import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { getLiveSessionReport, LiveSessionReport } from '../-services/utils';

export function useLiveSessionReport(): UseMutationResult<
    LiveSessionReport[],
    Error,
    { sessionId: string; scheduleId: string; accessType: string },
    unknown
> {
    return useMutation({
        mutationFn: ({
            sessionId,
            scheduleId,
            accessType,
        }: {
            sessionId: string;
            scheduleId: string;
            accessType: string;
        }) => getLiveSessionReport(sessionId, scheduleId, accessType),
    });
}
