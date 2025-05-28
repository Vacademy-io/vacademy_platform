import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

interface ProgressBarProps {
    progress: number;
}

export const ProgressBar = ({ progress }: ProgressBarProps) => {
    const [percentageValue, setPercentageValue] = useState(0);
    useEffect(() => {
        const percent = (progress / 365) * 100;
        setPercentageValue(percent);
    }, [progress]);
    return (
        <div className="flex flex-col gap-1">
            <Progress
                value={percentageValue}
                className={`w-full bg-white ${
                    progress >= 180
                        ? "[&>div]:bg-success-600"
                        : progress >= 30
                          ? "[&>div]:bg-warning-600"
                          : "[&>div]:bg-danger-600"
                }`}
            />
        </div>
    );
};
