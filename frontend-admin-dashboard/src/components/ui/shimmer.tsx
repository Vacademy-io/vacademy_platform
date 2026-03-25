import React from 'react';

interface ShimmerProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    rounded?: boolean;
}

export const Shimmer: React.FC<ShimmerProps> = ({
    className = '',
    width = '100%',
    height = '100%',
    rounded = false,
}) => {
    return (
        <div
            className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] ${rounded ? 'rounded-full' : 'rounded'} ${className}`}
            style={{
                width: typeof width === 'number' ? `${width}px` : width,
                height: typeof height === 'number' ? `${height}px` : height,
            }}
        />
    );
};

export const CourseImageShimmer: React.FC = () => (
    <div className="flex size-full w-full items-center justify-center overflow-hidden rounded-lg px-3 pb-0 pt-4">
        <Shimmer className="h-32 w-full rounded-lg" width="100%" height={128} />
    </div>
);

export const InstructorAvatarShimmer: React.FC = () => (
    <Shimmer className="size-7 rounded-full" width={28} height={28} />
);
