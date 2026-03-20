import { MyButton } from "@/components/design-system/button";
import { Calendar, CalendarDays, ListTodo } from "lucide-react";

export type ActivityPeriod = "today" | "tomorrow" | "all";

interface ActivityPeriodSelectorProps {
  selectedPeriod: ActivityPeriod;
  onSelect: (period: ActivityPeriod) => void;
}

export default function ActivityPeriodSelector({
  selectedPeriod,
  onSelect,
}: ActivityPeriodSelectorProps) {
  const options: { id: ActivityPeriod; label: string; icon: any }[] = [
    { id: "today", label: "Today", icon: Calendar },
    { id: "tomorrow", label: "Tomorrow", icon: CalendarDays },
    { id: "all", label: "All Activities", icon: ListTodo },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = selectedPeriod === option.id;
        return (
          <MyButton
            key={option.id}
            buttonType={isSelected ? "primary" : "secondary"}
            scale="small"
            onClick={() => onSelect(option.id)}
            className="gap-2"
          >
            <Icon className="size-4" />
            {option.label}
          </MyButton>
        );
      })}
    </div>
  );
}
