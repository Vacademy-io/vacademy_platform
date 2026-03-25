import { Check, ExclamationMark, X } from '@phosphor-icons/react';

export type StatusType = 'SUCCESS' | 'DANGER' | 'WARNING' | 'INFO';

const statusColors: Record<StatusType, string> = {
    SUCCESS: 'bg-success-100 text-success-600 border-success-400',
    DANGER: 'bg-danger-100 text-danger-600 border-danger-400',
    WARNING: 'bg-warning-100 text-warning-600 border-warning-400',
    INFO: 'bg-neutral-100 text-neutral-600 border-neutral-400',
};

const statusIcons: Record<StatusType, React.ReactNode> = {
    SUCCESS: (
        <Check className="size-3 rounded-full bg-success-600 p-[2px] text-white sm:size-4 sm:p-1" />
    ),
    DANGER: (
        <ExclamationMark className="size-3 rounded-full bg-danger-600 p-[2px] text-white sm:size-4 sm:p-1" />
    ),
    WARNING: (
        <ExclamationMark className="size-3 rounded-full bg-warning-600 p-[2px] text-white sm:size-4 sm:p-1" />
    ),
    INFO: <X className="size-3 rounded-full bg-neutral-500 p-[2px] text-white sm:size-4 sm:p-1" />,
};
export const StatusChip = ({
    text,
    textSize,
    status,
    showIcon = true,
}: {
    text: string;
    textSize: string;
    status: StatusType;
    showIcon?: boolean;
}) => {
    return (
        <div
            className={`w-fit border ${statusColors[status]} rounded-md sm:px-2 sm:py-1 ${textSize} sm:text-regular flex items-center gap-1 p-1 text-[11px]`}
        >
            {showIcon && statusIcons[status]}
            {text}
        </div>
    );
};
