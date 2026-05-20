import { cn } from '@/lib/utils';

interface StepperProps {
    total: number;
    current: number;
}

export function Stepper({ total, current }: StepperProps) {
    return (
        <div
            className="flex w-full items-center gap-2"
            aria-label={`Step ${current + 1} of ${total}`}
        >
            {Array.from({ length: total }).map((_, i) => (
                <span
                    key={i}
                    className={cn(
                        'h-1 flex-1 rounded-full transition-colors sm:max-w-[2.5rem]',
                        i < current && 'bg-neutral-900',
                        i === current && 'bg-neutral-900',
                        i > current && 'bg-neutral-200'
                    )}
                />
            ))}
        </div>
    );
}
