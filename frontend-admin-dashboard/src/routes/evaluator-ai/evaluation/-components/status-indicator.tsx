import { CheckCircle, FileSearch, Loader2, Scale, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "EXTRACTING_ANSWER" | "EVALUATING" | "EVALUATION_COMPLETED" | "WAITING";

interface StatusIndicatorProps {
    status: Status;
    className?: string;
}

export default function StatusIndicator({ status, className }: StatusIndicatorProps) {
    const statusConfig = {
        EXTRACTING_ANSWER: {
            label: "Extracting answers",
            icon: FileSearch,
            color: "text-blue-500",
            bgColor: "bg-blue-100",
            loading: true,
        },
        EVALUATING: {
            label: "Evaluating",
            icon: Scale,
            color: "text-amber-500",
            bgColor: "bg-amber-100",
            loading: true,
        },
        EVALUATION_COMPLETED: {
            label: "Completed",
            icon: CheckCircle,
            color: "text-green-500",
            bgColor: "bg-green-100",
            loading: false,
        },
        WAITING: {
            label: "Queued",
            icon: Timer,
            color: "text-gray-500",
            bgColor: "bg-gray-100",
            loading: false,
        },
    };

    const currentStatus = statusConfig[status];

    return (
        <div
            className={cn(
                "inline-flex items-center gap-2 rounded-full px-2.5 py-1.5",
                currentStatus.bgColor,
                className,
            )}
        >
            <div className="relative flex items-center justify-center">
                {currentStatus.loading && (
                    <Loader2 className={cn("absolute h-4 w-4 animate-spin", currentStatus.color)} />
                )}
                <currentStatus.icon
                    className={cn(
                        "h-4 w-4",
                        currentStatus.color,
                        currentStatus.loading && "opacity-0",
                    )}
                />
            </div>
            <span className={cn("text-xs font-medium", currentStatus.color)}>
                {currentStatus.label}
            </span>
        </div>
    );
}
