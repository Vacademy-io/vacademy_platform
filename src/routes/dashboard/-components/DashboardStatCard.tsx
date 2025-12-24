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
}: {
    title: string;
    count: number | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: any;
    onClick: () => void;
    isLoading?: boolean;
    className?: string;
}) => {
    if (isLoading) return <StatCardSkeleton />;

    return (
        <Card
            onClick={onClick}
            className={cn(
                "group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-md hover:border-primary/20 h-full",
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
            <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-primary/10 rounded-md text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary/20">
                        <Icon size={20} weight="duotone" className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <ChevronRight
                        size={16}
                        className="text-muted-foreground group-hover:text-primary transition-all duration-300 group-hover:translate-x-0.5"
                    />
                </div>

                <div className="space-y-1">
                    <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        {(count ?? 0).toLocaleString()}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1">
                        {title}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
