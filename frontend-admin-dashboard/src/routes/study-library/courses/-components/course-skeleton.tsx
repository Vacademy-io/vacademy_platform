import { Skeleton } from '@/components/ui/skeleton';

function CourseCardSkeleton() {
    return (
        <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {/* Course image placeholder */}
            <Skeleton className="h-36 w-full rounded-none" />

            <div className="flex flex-col gap-2 p-4">
                {/* Title */}
                <Skeleton className="h-5 w-3/4" />
                {/* Subtitle / level */}
                <Skeleton className="h-4 w-1/2" />

                {/* Instructor row */}
                <div className="mt-2 flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                </div>

                {/* Rating / stats */}
                <div className="mt-1 flex items-center gap-3">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-12" />
                </div>

                {/* Tags */}
                <div className="mt-2 flex gap-2">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-18 rounded-full" />
                </div>
            </div>
        </div>
    );
}

export function CourseExplorerSkeleton() {
    return (
        <div className="flex flex-col gap-6 p-4">
            {/* Header skeleton (search bar + filters) */}
            <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
                <div className="ml-auto">
                    <Skeleton className="h-10 w-28" />
                </div>
            </div>

            {/* Course cards grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <CourseCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}
