
import { Button } from "@/components/ui/button";
import { ArrowSquareOut } from "@phosphor-icons/react";

interface DefaultClassCardProps {
    defaultClassLink: string;
    defaultClassName?: string | null;
}

export const DefaultClassCard = ({
    defaultClassLink,
    defaultClassName,
}: DefaultClassCardProps) => {
    const displayTitle = defaultClassName || "Default Session";

    return (
        <div className="p-4 border rounded-xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1 w-full sm:w-auto">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg text-neutral-800 dark:text-neutral-100">
                            {displayTitle}
                        </h3>
                        <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs font-medium rounded-full whitespace-nowrap">
                            No Live Session
                        </span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                        There is no live session currently. You can watch this session.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button
                        variant="default"
                        size="sm"
                        className="w-full sm:w-auto shrink-0"
                        onClick={() => {
                            window.open(defaultClassLink, "_blank");
                        }}
                    >
                        <ArrowSquareOut size={16} className="mr-1.5 text-white" />
                        <span className="text-white">View Session</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};
