import React, { useState } from "react";
import { useCatalogStore } from "../-store/catalogStore";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleFetchInstituteDetails } from "../-services/institute-details";

// Internal reusable component for individual filter sections
interface FilterSectionProps {
    title: string;
    items: { id: string; name: string }[];
    selectedItems: string[];
    handleChange: (itemId: string) => void;
    disabled?: boolean;
}

const FilterSection: React.FC<FilterSectionProps> = ({
    title,
    items,
    selectedItems,
    handleChange,
    disabled,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const initialDisplayCount = 3;
    const canExpand = items.length > initialDisplayCount;
    const itemsToDisplay =
        canExpand && !isExpanded ? items.slice(0, initialDisplayCount) : items;

    return (
        <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">
                {title}
            </h3>
            <div className="space-y-2">
                {items.length === 0 && !disabled && (
                    <p className="text-sm text-gray-500">
                        No {title.toLowerCase()} available.
                    </p>
                )}
                {disabled && (
                    <p className="text-sm text-gray-500">
                        {title} filters are currently unavailable.
                    </p>
                )}
                {itemsToDisplay.map((item) => (
                    <label
                        key={item.id}
                        className={`flex items-center text-gray-600 hover:text-gray-800 ${
                            disabled
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer"
                        }`}
                    >
                        <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                            checked={selectedItems.includes(item.id)}
                            onChange={() => handleChange(item.id)}
                            disabled={disabled}
                        />
                        {item.name}
                    </label>
                ))}
            </div>

            {canExpand && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    disabled={disabled}
                    className={`text-sm mt-2 ${
                        disabled
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-blue-600 hover:text-blue-800"
                    }`}
                >
                    {isExpanded ? "Show Less" : "Show More"}
                </button>
            )}
        </div>
    );
};

// Props for the entire filter panel
interface FilterPanelProps {
    selectedLevels: string[];
    onLevelChange: (levelId: string) => void;
    selectedTags: string[];
    onTagChange: (tagId: string) => void;
    selectedInstructors: string[];
    onInstructorChange: (instructorId: string) => void;
    clearAllFilters: () => void;
    onApplyFilters: () => void;
    levelsDisabled?: boolean;
    tagsDisabled?: boolean;
    instructorsDisabled?: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
    selectedLevels,
    onLevelChange,
    selectedTags,
    onTagChange,
    selectedInstructors,
    onInstructorChange,
    clearAllFilters,
    onApplyFilters,
    levelsDisabled = false,
    tagsDisabled = false,
    instructorsDisabled = false,
}) => {
    const { instructor } = useCatalogStore();

    const { data: instituteData, isLoading } = useSuspenseQuery(
        handleFetchInstituteDetails()
    );

    const hasActiveFilters =
        selectedLevels.length > 0 ||
        selectedTags.length > 0 ||
        selectedInstructors.length > 0;

    const levels = (instituteData?.levels || []).map((level: any) => ({
        id: level.id,
        name: level.level_name || "Unnamed Level",
    }));

    const tags = (instituteData?.tags || []).map((tag: string) => ({
        id: tag,
        name: tag,
    }));

    const instructors = (instructor || []).map((inst: any) => ({
        id: inst.id,
        name: inst.full_name || inst.username || "Unnamed Instructor",
    }));

    if (isLoading) return <DashboardLoader />;

    return (
        <div className="bg-white p-6 rounded-lg shadow ml-0">
            <div className="flex justify-between items-center mb-6 gap-1 w-full">
                <h2 className="text-xl font-bold text-gray-800">Filters</h2>
                <div className="flex">
                    <button
                        onClick={clearAllFilters}
                        disabled={!hasActiveFilters}
                        className={`whitespace-nowrap text font-semibold px-2 py-1 transition text-primary-500 text-sm mt-[1px]`}
                    >
                        Clear
                    </button>
                    <button
                        onClick={onApplyFilters}
                        disabled={!hasActiveFilters}
                        className={`text-white text-xs font-semibold px-3 py-1 mt-1 h-fit transition bg-primary-500 rounded-md`}
                    >
                        Apply
                    </button>
                </div>
            </div>

            <FilterSection
                title="Level"
                items={levels}
                selectedItems={selectedLevels}
                handleChange={onLevelChange}
                disabled={levelsDisabled || levels.length === 0}
            />

            <FilterSection
                title="Popular Topics"
                items={tags}
                selectedItems={selectedTags}
                handleChange={onTagChange}
                disabled={tagsDisabled || tags.length === 0}
            />

            <FilterSection
                title="Instructors"
                items={instructors}
                selectedItems={selectedInstructors}
                handleChange={onInstructorChange}
                disabled={instructorsDisabled || instructors.length === 0}
            />
        </div>
    );
};

export default FilterPanel;
