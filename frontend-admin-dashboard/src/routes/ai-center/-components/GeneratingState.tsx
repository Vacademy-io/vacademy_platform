import { Sparkle } from '@phosphor-icons/react';

export const GeneratingState = ({
    title,
    subtitle,
}: {
    title: string;
    subtitle?: string;
}) => (
    <div className="flex w-full flex-col items-center gap-4 overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-blue-50 p-8 text-center">
        <div className="relative flex size-14 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary-200 opacity-50" />
            <div className="relative flex size-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg">
                <Sparkle size={24} weight="fill" />
            </div>
        </div>
        <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-gray-900">{title}</p>
            {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
        </div>
        <div className="relative h-1 w-full max-w-xs overflow-hidden rounded-full bg-primary-100">
            <div className="absolute inset-y-0 left-0 w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-primary-500 to-transparent" />
        </div>
        <style>{`
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(400%); }
            }
        `}</style>
    </div>
);
