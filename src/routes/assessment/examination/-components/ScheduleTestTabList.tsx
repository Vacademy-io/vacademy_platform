import { Badge } from "@/components/ui/badge";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assessmentTypes } from "@/types/assessment";

const ScheduleTestTabList = ({
  selectedTab,
  totalAssessments,
}: {
  selectedTab: string;
  totalAssessments: { [key: string]: number };
}) => {
  return (
    <div className="flex items-center pb-2 sm:pb-4 gap-2 sm:gap-4 overflow-x-auto px-2 sm:px-0">
      <TabsList className="inline-flex h-auto justify-start gap-2 sm:gap-4 rounded-none border-b !bg-transparent p-0 min-w-max">
        {Object.values(assessmentTypes).map((type) => (
          <TabsTrigger
            key={type}
            value={type}
            className={`flex gap-1.5 rounded-none px-4 sm:px-6 md:px-8 py-2 text-sm md:text-base !shadow-none ${
              selectedTab === type
                ? "rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50"
                : "border-none bg-transparent"
            }`}
          >
            <span className={selectedTab === type ? "text-primary-500" : ""}>
              {type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}
            </span>
            <Badge
              className="rounded-[10px] bg-primary-500 p-0 px-2 text-[9px] text-white"
              variant="outline"
            >
              {totalAssessments[type] || 0}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
};

export default ScheduleTestTabList;
