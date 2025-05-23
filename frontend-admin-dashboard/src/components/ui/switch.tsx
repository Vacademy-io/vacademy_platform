import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";
import { Check, X } from "phosphor-react";

const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitives.Root
        className={cn(
            "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=unchecked]:border data-[state=unchecked]:border-neutral-500 data-[state=checked]:bg-primary-500 data-[state=unchecked]:bg-input data-[state=unchecked]:bg-primary-100",
            className,
        )}
        {...props}
        ref={ref}
    >
        <SwitchPrimitives.Thumb
            className={cn(
                "pointer-events-none ml-[1px] flex size-4 items-center justify-center rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-neutral-500",
            )}
        >
            {/* Conditionally render the Check icon based on the data-state */}
            <SwitchPrimitives.Root data-state="checked">
                {props.checked ? (
                    <Check size={12} weight="thin" />
                ) : (
                    <X size={12} className="rounded-full bg-neutral-500 text-white" />
                )}
            </SwitchPrimitives.Root>
        </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
