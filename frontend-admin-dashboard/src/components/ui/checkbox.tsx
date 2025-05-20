"use client";
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
    React.ElementRef<typeof CheckboxPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
        ref={ref}
        className={cn(
            "group relative h-4 w-4 shrink-0 rounded-[2px] border border-neutral-400 shadow",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "data-[state=checked]:border-primary-500 data-[state=checked]:bg-primary-500 data-[state=checked]:text-white",
            className,
        )}
        {...props}
    >
        {/* Default Checkmark (Visible when checked) */}
        <CheckboxPrimitive.Indicator
            className={cn("flex items-center justify-center text-current transition-all")}
        >
            <CheckIcon className="size-4 text-white" />
        </CheckboxPrimitive.Indicator>

        {/* Square (Only appears when hovered & checked) */}
        <CheckboxPrimitive.Indicator className="absolute inset-0 hidden items-center justify-center text-current transition-all">
            <div className="size-2 bg-primary-500"></div>
        </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;
export { Checkbox };
