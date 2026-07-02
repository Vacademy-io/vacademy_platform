import { Info } from '@phosphor-icons/react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Small info icon that reveals an explanation. Opens on hover and on
 * click/focus (the trigger is a real button), so it works with a mouse, a tap,
 * and the keyboard — unlike a native `title` attribute.
 */
export function InfoHint({ text }: { text: string }) {
    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label="More info"
                        className="inline-flex text-gray-400 transition-colors hover:text-gray-600"
                    >
                        <Info className="size-3.5" />
                    </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                    <p className="text-xs font-normal normal-case">{text}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
