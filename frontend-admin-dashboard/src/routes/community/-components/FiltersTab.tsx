import {
    FilterStreamDropdown,
    FilterSubjectDropdown,
    FilterDifficultiesDropdown,
    FilterTypesDropdown,
} from "./FilterDropdown";
import { Chip } from "./Chips";
import { useState, useRef } from "react";
import { useSelectedFilterStore } from "../-store/useSlectedFilterOption";
import { useFilterStore } from "../-store/useFilterOptions";

export function FiltersTab() {
    const { options } = useFilterStore();
    const [expanded, setExpanded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const { selected } = useSelectedFilterStore();

    return (
        <div className="mx-10 mb-10 flex flex-col gap-6 border-b pb-6">
            <div className="flex flex-row flex-wrap justify-around gap-4 rounded bg-sidebar-background p-4">
                {selected.level && (
                    <FilterStreamDropdown
                        placeholder="Select Stream"
                        FilterList={options.streams[selected.level?.levelId] || []}
                    />
                )}
                {selected.stream && (
                    <FilterSubjectDropdown
                        FilterList={options.subjects[selected.stream.streamId] || []}
                        placeholder="Select Subject"
                    />
                )}
                <FilterDifficultiesDropdown
                    FilterList={options.difficulties || []}
                    placeholder="Select Difficulty"
                />
                <FilterTypesDropdown FilterList={options.types || []} placeholder="Select Type" />
            </div>
            <div
                ref={containerRef}
                className={`relative flex flex-wrap gap-4 pb-6 transition-all duration-300 ${
                    expanded ? "max-h-[1000px]" : "max-h-[56px] overflow-hidden"
                }`}
            >
                {options?.tags?.map((tag, index) => <Chip key={index} tag={tag} />)}
                <div className="absolute -bottom-[6px] right-0">
                    <button onClick={() => setExpanded(!expanded)} className="text-primary-500">
                        {!expanded ? "See More" : "See Less"}
                    </button>
                </div>
            </div>
        </div>
    );
}
