import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                className={cn(
                    // Explicit text-neutral-700 so typed text is always visible: the
                    // textarea otherwise inherits `color`, which is near-white on
                    // dark-OS devices → white-on-white answer text (mirrors MyInput).
                    "flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base text-neutral-700 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                    className,
                )}
                ref={ref}
                {...props}
            />
        );
    },
);
Textarea.displayName = "Textarea";

export { Textarea };
