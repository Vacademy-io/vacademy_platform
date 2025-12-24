import { Badge } from "@/components/ui/badge";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assessmentTypes } from "@/types/assessment";
import { PlayCircle, CalendarClock, History } from "lucide-react";
import { cn } from "@/lib/utils";

const tabIcons = {
  [assessmentTypes.LIVE]: PlayCircle,
  [assessmentTypes.UPCOMING]: CalendarClock,
  [assessmentTypes.PAST]: History,
};

const ScheduleTestTabList = ({
  selectedTab,
  totalAssessments,
}: {
  selectedTab: string;
  totalAssessments: { [key: string]: number };
}) => {
  return (
    <div className="flex items-center pb-4 overflow-x-auto">
      <TabsList className="h-auto p-1 bg-muted w-full sm:w-auto">
        {Object.values(assessmentTypes).map((type) => {
          const Icon = tabIcons[type as assessmentTypes];
          const count = totalAssessments[type];
          return (
            <TabsTrigger
              key={type}
              value={type}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                "flex-1 sm:flex-none justify-center"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>
                {type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}
              </span>
              {count > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 rounded-full px-2 py-0.5 text-[10px] h-5 min-w-5 flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20"
                >
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
};

export default ScheduleTestTabList;
