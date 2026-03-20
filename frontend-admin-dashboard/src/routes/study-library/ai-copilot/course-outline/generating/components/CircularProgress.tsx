import { CircularProgressProps } from '../../../shared/types';

export const CircularProgress = ({ value, size = 24, strokeWidth = 3, className = '' }: CircularProgressProps) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (value / 100) * circumference;

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    className="text-neutral-200"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="text-indigo-600 transition-all duration-300"
                />
            </svg>
            {value < 100 && (
                <span className="absolute text-[10px] font-semibold text-indigo-600">
                    {Math.round(value)}%
                </span>
            )}
        </div>
    );
};
