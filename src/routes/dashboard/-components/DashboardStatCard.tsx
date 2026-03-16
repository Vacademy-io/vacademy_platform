import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const StatCardSkeleton = () => (
    <Card className="h-full">
        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
            </div>
        </CardContent>
    </Card>
);

export const StatCard = ({
    title,
    count,
    icon: Icon,
    onClick,
    isLoading = false,
    className,
    iconClassName,
}: {
    title: string;
    count: number | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: any;
    onClick: () => void;
    isLoading?: boolean;
    className?: string;
    iconClassName?: string;
}) => {
    if (isLoading) return <StatCardSkeleton />;

    return (
        <Card
            onClick={onClick}
            className={cn(
                "group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-md hover:border-primary/20 h-full",
                // Vibrant Mode Styles
                "[.ui-vibrant_&]:bg-slate-50 dark:[.ui-vibrant_&]:bg-slate-900/30",
                "[.ui-vibrant_&]:border-slate-200 dark:[.ui-vibrant_&]:border-slate-700",
                className
            )}
            tabIndex={0}
            role="button"
            aria-label={`View ${title} - ${count} items`}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                }
            }}
        >
            <CardContent className="p-3 sm:p-4 flex flex-col justify-between h-full relative z-10">
                <div className="flex items-center justify-between mb-3">
                    <div className={cn(
                        "p-2 bg-primary/10 rounded-md text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary/20",
                        // Vibrant Mode Icon Styles
                        "[.ui-vibrant_&]:ring-0 [.ui-vibrant_&]:text-slate-700",
                        "[.ui-vibrant_&]:dark:bg-slate-800 [.ui-vibrant_&]:dark:text-slate-300",
                        iconClassName
                    )}>
                        <Icon size={20} weight="duotone" className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <ChevronRight
                        size={16}
                        className="text-muted-foreground group-hover:text-primary transition-all duration-300 group-hover:translate-x-0.5"
                    />
                </div>

                <div className="space-y-1">
                    <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                        {(count ?? 0).toLocaleString()}
                    </div>
                    <div className={cn(
                        "text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1",
                        "[.ui-vibrant_&]:text-primary/70 [.ui-vibrant_&]:group-hover:text-primary"
                    )}>
                        {title}
                    </div>
                </div>
            </CardContent>

            {/* Vibrant Decorator */}
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl hidden [.ui-vibrant_&]:block group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
        </Card>
    );
};
