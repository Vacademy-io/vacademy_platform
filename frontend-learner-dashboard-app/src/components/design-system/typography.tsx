import * as React from "react";
import { cn } from "@/lib/utils";

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;

export const H1: React.FC<HeadingProps> = ({ className, children, ...props }) => (
  <h1
    className={cn(
      "text-xl sm:text-2xl font-semibold tracking-tight text-gray-900",
      className,
    )}
    {...props}
  >
    {children}
  </h1>
);

export const H2: React.FC<HeadingProps> = ({ className, children, ...props }) => (
  <h2
    className={cn(
      "text-lg sm:text-xl font-semibold text-gray-900",
      className,
    )}
    {...props}
  >
    {children}
  </h2>
);

export const H3: React.FC<HeadingProps> = ({ className, children, ...props }) => (
  <h3
    className={cn(
      "text-base sm:text-lg font-semibold text-gray-900",
      className,
    )}
    {...props}
  >
    {children}
  </h3>
);


