import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
    <ProgressPrimitive.Root
        ref={ref}
        className={cn("relative h-4 w-full overflow-hidden rounded-full !bg-white", className)}
        {...props}
    >
        <ProgressPrimitive.Indicator
            className="size-full flex-1 bg-primary-500 transition-all"
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
    </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

const ReverseProgressBar = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
    <ProgressPrimitive.Root
        ref={ref}
        className={cn(
            "bg-primary relative h-4 w-full overflow-hidden rounded-full border",
            className,
        )}
        {...props}
    >
        <ProgressPrimitive.Indicator
            className="size-full flex-1 bg-primary-300 transition-all"
            style={{ transform: `translateX(${100 - (value || 0)}%)` }}
        />
    </ProgressPrimitive.Root>
));
ReverseProgressBar.displayName = ProgressPrimitive.Root.displayName;

export { Progress, ReverseProgressBar };
