import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export const LoadingOverlay = ({
    pageNumber,
    numPages,
}: {
    pageNumber: number;
    numPages: number;
}) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-[0.5px]">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
            <div className="flex flex-col items-center space-y-4">
                <h1 className="text-lg font-medium">Generating PDF</h1>
                <p className="text-gray-500">This may take a moment...</p>
                <Progress value={(pageNumber / numPages) * 100} className="h-2" />
                <h3 className="text-lg font-medium">
                    Done ({pageNumber} of {numPages})
                </h3>
            </div>
        </div>
    </div>
);

export function UploadingOverlay({ progress }: { progress: number }) {
    const [progressValue, setProgressValue] = useState(0);

    useEffect(() => {
        // Animate the progress value for a smoother transition
        const timeout = setTimeout(() => {
            setProgressValue(progress);
        }, 100);

        return () => clearTimeout(timeout);
    }, [progress]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-[0.5px]">
            <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
                <div className="flex flex-col items-center space-y-4">
                    <div className="flex items-center justify-center">
                        <Loader2 className="mr-2 size-6 animate-spin text-primary-300" />
                        <h3 className="text-lg font-medium">Saving File, it might take a while</h3>
                    </div>

                    <div className="w-full space-y-2">
                        <Progress value={progressValue} className="h-2 w-full" />
                        <p className="text-center text-sm text-muted-foreground">
                            {Math.round(progressValue)}% complete
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
