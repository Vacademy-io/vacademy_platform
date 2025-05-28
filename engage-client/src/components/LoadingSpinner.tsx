// src/components/LoadingSpinner.tsx
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
  fullScreen?: boolean;
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 32,
  className,
  fullScreen = false,
  text
}) => {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
        <Loader2 className={cn("animate-spin text-primary", className)} style={{ width: size, height: size }} />
        {text && <p className="mt-3 text-lg text-foreground/80">{text}</p>}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <Loader2 className="animate-spin text-primary" style={{ width: size, height: size }} />
      {text && <p className="mt-2 text-sm text-foreground/70">{text}</p>}
    </div>
  );
};