import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Loading state for the "contentOnly" course-details layout.
 *
 * The generic DashboardLoader is a centred branded spinner sized for a full
 * page — under this layout it resolves into a title plus one card, so the
 * spinner made the page visibly jump and told the learner nothing about what
 * was coming. This mirrors the real thing: title, the Content Structure card
 * header, and the same card grid the drill-down uses (one per row on phones,
 * matching contentGridClass in course-structure-details).
 */
export const ContentOnlyCourseDetailsSkeleton = () => (
  <div
    className="min-h-screen bg-background w-full max-w-full"
    role="status"
    aria-label="Loading course content"
  >
    {/* Header — title only, matching CourseHeader's minimal mode */}
    <div className="px-2 py-3 sm:px-0 lg:py-4">
      <Skeleton className="h-9 w-3/4 max-w-lg sm:h-10" />
    </div>

    {/* The Content Structure card */}
    <div className="relative z-10 w-full px-2 sm:px-0 py-2 lg:py-3">
      <div className="flex size-full flex-col gap-3 rounded-lg bg-card pt-0 pb-3">
        <div className="rounded-lg border border-neutral-200/60 bg-white p-3 md:p-4">
          {/* Card header: icon + "Content Structure" */}
          <div className="flex items-center gap-3 border-b border-neutral-200 pb-4">
            <Skeleton className="size-6 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>

          <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card
                key={i}
                className="h-full overflow-hidden border-neutral-200 bg-card rounded-xl"
              >
                <CardContent className="p-0 flex flex-col h-full">
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <div className="flex flex-col gap-2 p-3 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);
