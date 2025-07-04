import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        "backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

// Glassmorphism variant of Input for use with the dark theme
function GlassmorphismInput({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="glassmorphism-input"
      className={cn(
        "bg-white/10 border border-white/20 text-white placeholder:text-white/50",
        "focus:border-orange-400/50 focus:ring-orange-400/25 backdrop-blur-sm",
        "transition-all duration-300 ease-out hover:bg-white/15",
        "flex h-9 w-full min-w-0 rounded-md px-3 py-1 text-base shadow-xs outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input, GlassmorphismInput }
