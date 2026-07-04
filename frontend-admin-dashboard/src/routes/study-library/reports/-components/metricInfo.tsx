import { Info } from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Small "ⓘ" hover tooltip used next to report metric labels so admins know
 * exactly what each number (Concentration Score, Course Completed, etc.) means.
 */
export function MetricInfo({ text }: { text: string }) {
    return (
        <TooltipProvider delayDuration={150}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label="What is this?"
                        className="text-neutral-400 transition-colors hover:text-primary-500"
                    >
                        <Info className="size-4" />
                    </button>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="z-50 max-w-xs rounded-md border border-neutral-200 bg-white px-3 py-2 text-caption font-normal leading-relaxed text-neutral-700 shadow-lg"
                >
                    {text}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/** Canonical metric explanations, shared across the report views. */
export const METRIC_INFO = {
    courseCompleted:
        'Average % of course content completed — based on video watch time and document pages viewed across all published slides in this course.',
    timeSpentAvg:
        'Average time spent learning per active day in the selected date range.',
    concentration:
        'A focus score (0–100%) recorded while studying videos. It starts at 100 and drops for tab switches, pauses, and missed in-video check questions — higher means more focused.',
    leaderboard:
        'Learners ranked by total learning time, with concentration score as the tie-breaker.',
} as const;
