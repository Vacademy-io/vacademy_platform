import { useIsMobile } from "@/hooks/use-mobile";

export const ScheduleTestHeaderDescription = () => {
  const isMobile = useIsMobile();

  return (
    <div
      className={`mb-8 flex items-center justify-between ${isMobile ? "flex-wrap gap-4" : "gap-10"
        }`}
    >
      <div className="flex flex-col w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Stay Assessment Ready
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          View all the Assessments created by the admin, along with their
          schedules and statuses to stay on track.
        </p>
      </div>
    </div>
  );
};
