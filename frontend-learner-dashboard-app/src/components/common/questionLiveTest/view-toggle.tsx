import { LayoutGrid, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ViewToggleProps {
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(v) => v && onViewChange(v as "grid" | "list")}
      className="flex gap-2"
    >
      <ToggleGroupItem
        value="grid"
        aria-label="Grid view"
        className={`p-2 border rounded ${
          view === "grid" ? "border-primary-500 " : ""
        }`}
      >   
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="list"
        aria-label="List view"
        className={`p-2 border rounded hover:bg-gray-50 ${
          view === "list"
            ? "border-primary-500 text-primary-500"
            : "border-gray-200"
        }`}
      >
        <List className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
