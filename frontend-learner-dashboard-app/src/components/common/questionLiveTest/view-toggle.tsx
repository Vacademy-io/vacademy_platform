import { GridFour, List } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { QuestionPaletteView } from "@/types/assessment-experience";

interface ViewToggleProps {
  view: QuestionPaletteView;
  onViewChange: (view: QuestionPaletteView) => void;
}

const OPTIONS: Array<{
  value: QuestionPaletteView;
  label: string;
  Icon: typeof GridFour;
}> = [
  { value: "grid", label: "Grid view", Icon: GridFour },
  { value: "list", label: "List view", Icon: List },
];

/** Segmented control for the question palette's grid / list modes. */
export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex flex-none gap-0.5 rounded-lg bg-neutral-200 p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => {
        const isActive = view === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => onViewChange(value)}
            className={cn(
              "grid size-7 place-items-center rounded-md transition-colors",
              isActive
                ? "bg-white text-neutral-800 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700",
            )}
          >
            <Icon size={15} weight={isActive ? "fill" : "regular"} />
          </button>
        );
      })}
    </div>
  );
}
