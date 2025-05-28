import { useState } from "react";
import { TagResponse } from "@/types/community/filters/types";
import { useFilterStore } from "../-store/useFilterOptions";

interface ChipProps {
    tag: TagResponse;
}

export function Chip({ tag }: ChipProps) {
    const { addSelectedChip, removeSelectedChip } = useFilterStore();
    const [selected, setSelected] = useState<boolean>(false);
    function onSelected() {
        if (!selected) {
            addSelectedChip(tag);
        } else {
            removeSelectedChip(tag.tagId);
        }
        setSelected(!selected);
    }
    return (
        <div
            className={`rounded-md border ${
                selected ? "border-primary-500 bg-primary-100" : ""
            } cursor-pointer px-3 py-2 text-body`}
            onClick={onSelected}
        >
            {tag.tagName}
        </div>
    );
}
