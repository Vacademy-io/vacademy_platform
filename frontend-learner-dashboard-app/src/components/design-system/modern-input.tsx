import { cn } from "@/lib/utils";
import { forwardRef, useState } from "react";

export interface ModernInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "filled" | "outlined" | "ghost";
  inputSize?: "sm" | "md" | "lg";
  state?: "default" | "error" | "success" | "warning";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  label?: string;
  helperText?: string;
  errorText?: string;
  isLoading?: boolean;
}

const modernInputVariants = {
  base: "flex w-full transition-all duration-200 ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  
  variant: {
    default: "border border-input bg-background hover:border-primary-300 focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-100",
    filled: "border-0 bg-accent hover:bg-accent/80 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary-100",
    outlined: "border-2 border-border bg-transparent hover:border-primary-300 focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-100",
    ghost: "border-0 bg-transparent hover:bg-accent/50 focus-visible:bg-accent/30 focus-visible:ring-2 focus-visible:ring-primary-100",
  },
  
  size: {
    sm: "h-9 px-3 py-2 text-caption rounded-md",
    md: "h-10 px-3 py-2 text-body rounded-lg",
    lg: "h-11 px-4 py-2 text-subtitle rounded-lg",
  },
  
  state: {
    default: "",
    error: "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
    success: "border-success-500 focus-visible:border-success-500 focus-visible:ring-success-500/20",
    warning: "border-warning-500 focus-visible:border-warning-500 focus-visible:ring-warning-500/20",
  },
  
  withLeftIcon: {
    sm: "pl-9",
    md: "pl-10",
    lg: "pl-11",
  },
  
  withRightIcon: {
    sm: "pr-9",
    md: "pr-10",
    lg: "pr-11",
  },
};

const ModernInput = forwardRef<HTMLInputElement, ModernInputProps>(
  ({
    className,
    variant = "default",
    inputSize = "md",
    state = "default",
    leftIcon,
    rightIcon,
    label,
    helperText,
    errorText,
    isLoading = false,
    type = "text",
    ...props
  }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    
    const inputClasses = cn(
      modernInputVariants.base,
      modernInputVariants.variant[variant],
      modernInputVariants.size[inputSize],
      modernInputVariants.state[state],
      leftIcon && modernInputVariants.withLeftIcon[inputSize],
      rightIcon && modernInputVariants.withRightIcon[inputSize],
      className
    );

    const iconSize = {
      sm: "h-4 w-4",
      md: "h-5 w-5", 
      lg: "h-6 w-6",
    }[inputSize];

    const iconPosition = {
      sm: { left: "left-2.5", right: "right-2.5" },
      md: { left: "left-3", right: "right-3" },
      lg: { left: "left-3", right: "right-3" },
    }[inputSize];

    return (
      <div className="space-y-2">
        {label && (
          <label className={cn(
            "text-caption font-medium text-foreground",
            state === "error" && "text-destructive",
            state === "success" && "text-success-600",
            state === "warning" && "text-warning-600"
          )}>
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className={cn(
              "absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
              iconPosition.left,
              isFocused && "text-primary-500"
            )}>
              <div className={iconSize}>{leftIcon}</div>
            </div>
          )}
          
          <input
            className={inputClasses}
            ref={ref}
            type={type}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            disabled={isLoading || props.disabled}
            {...props}
          />
          
          {(rightIcon || isLoading) && (
            <div className={cn(
              "absolute top-1/2 -translate-y-1/2 text-muted-foreground",
              iconPosition.right
            )}>
              {isLoading ? (
                <div className={cn(
                  "animate-spin rounded-full border-2 border-current border-t-transparent",
                  iconSize
                )} />
              ) : (
                <div className={iconSize}>{rightIcon}</div>
              )}
            </div>
          )}
        </div>
        
        {(helperText || errorText) && (
          <p className={cn(
            "text-xs",
            state === "error" ? "text-destructive" : "text-muted-foreground",
            state === "success" && "text-success-600",
            state === "warning" && "text-warning-600"
          )}>
            {state === "error" && errorText ? errorText : helperText}
          </p>
        )}
      </div>
    );
  }
);

ModernInput.displayName = "ModernInput";

export { ModernInput, modernInputVariants }; 