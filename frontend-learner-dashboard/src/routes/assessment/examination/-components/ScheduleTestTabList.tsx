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
    <div className="flex items-center pb-4 gap-4 overflow-x-auto">
      <TabsList className="inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
        {Object.values(assessmentTypes).map((type) => (
          <TabsTrigger
            key={type}
            value={type}
            className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
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
