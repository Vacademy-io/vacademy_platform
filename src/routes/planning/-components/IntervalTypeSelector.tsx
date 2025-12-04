import type { IntervalType } from "../-types/types";
import { Calendar, CalendarDays, CalendarClock, ListTodo } from "lucide-react";
import { MyButton } from "@/components/design-system/button";

export type PlanningPeriod = IntervalType | "all";

interface IntervalTypeSelectorProps {
  selectedType: PlanningPeriod;
  onSelect: (type: PlanningPeriod) => void;
}

export default function IntervalTypeSelector({
  selectedType,
  onSelect,
}: IntervalTypeSelectorProps) {
  const options: { id: PlanningPeriod; label: string; icon: any }[] = [
    { id: "weekly", label: "Today", icon: Calendar },
    { id: "monthly", label: "This Week", icon: CalendarDays },
    { id: "yearly_month", label: "This Month", icon: CalendarClock },
    { id: "yearly_quarter", label: "This Quarter", icon: CalendarClock },
    { id: "all", label: "All Plannings", icon: ListTodo },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = selectedType === option.id;
        return (
          <MyButton
            key={option.id}
            buttonType={isSelected ? "primary" : "secondary"}
            //     variant={isSelected ? "default" : "outline"}
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
