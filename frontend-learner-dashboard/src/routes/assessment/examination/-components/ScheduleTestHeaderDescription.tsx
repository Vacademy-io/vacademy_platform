import { useIsMobile } from "@/hooks/use-mobile";

export const ScheduleTestHeaderDescription = () => {
  const isMobile = useIsMobile();

  return (
    <div
      className={`mb-8 flex  items-center justify-between ${
        isMobile ? "flex-wrap gap-4" : "gap-10"
      }`}
    >
      {/* Responsive Container for Heading and Description */}
      <div className="flex flex-col w-full sm:w-80% md:w-66% lg:w-50%">
        <h1 className="text-[1.25rem] font-semibold text-neutral-600 text-weight-600 sm:text-[1.5rem] md:text-[1.75rem] lg:text-[2rem]">
          Stay Assessment Ready
        </h1>
        <p className="text-neutral-600 text-sm sm:text-base md:text-lg lg:text-xl">
          View all the Assessments created by the admin, along with their
          schedules and statuses to stay on track.
        </p>
      </div>
    </div>
  );
};
