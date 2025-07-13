import React, { useState } from "react";
import { useCatalogStore } from "../-store/catalogStore";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleFetchInstituteDetails } from "../-services/institute-details";
import { Filter, Check, ChevronDown, ChevronUp, X } from 'lucide-react';

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
    const [isExpanded, setIsExpanded] = useState(true);
    const initialDisplayCount = 5;
    const canExpand = items.length > initialDisplayCount;
    const itemsToDisplay =
        canExpand && !isExpanded ? items.slice(0, initialDisplayCount) : items;

    return (
        <div className="border-b border-gray-200 pb-4 mb-4 last:border-b-0 last:pb-0 last:mb-0">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                {selectedItems.length > 0 && (
                    <span className="bg-primary-100 text-primary-700 text-xs font-medium px-2 py-1 rounded-full">
                        {selectedItems.length}
                    </span>
                )}
            </div>

            {/* Filter Items */}
            <div className="space-y-2">
                {items.length === 0 && !disabled && (
                    <div className="text-sm text-gray-500 py-2">
                        No {title.toLowerCase()} available
                    </div>
                )}
                {disabled && (
                    <div className="text-sm text-gray-500 py-2">
                        {title} filters are currently unavailable
                    </div>
                )}
                {itemsToDisplay.map((item) => (
                    <label
                        key={item.id}
                        className={`flex items-center space-x-3 p-2 rounded-md cursor-pointer transition-colors ${
                            disabled
                                ? "cursor-not-allowed opacity-50"
                                : "hover:bg-gray-50"
                        } ${selectedItems.includes(item.id) ? "bg-primary-50" : ""}`}
                    >
                        <div className="relative">
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={selectedItems.includes(item.id)}
                                onChange={() => handleChange(item.id)}
                                disabled={disabled}
                            />
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                selectedItems.includes(item.id) 
                                    ? "border-primary-500 bg-primary-500" 
                                    : "border-gray-300"
                            }`}>
                                {selectedItems.includes(item.id) && (
                                    <Check size={12} className="text-white" />
                                )}
                            </div>
                        </div>
                        <span className={`text-sm ${
                            selectedItems.includes(item.id) 
                                ? "text-primary-700 font-medium" 
                                : "text-gray-700"
                        }`}>
                            {item.name}
                        </span>
                    </label>
                ))}
            </div>

            {/* Expand/Collapse Button */}
            {canExpand && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    disabled={disabled}
                    className={`w-full mt-3 p-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center space-x-2 ${
                        disabled
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                    }`}
                >
                    <span>{isExpanded ? "Show Less" : `Show ${items.length - initialDisplayCount} More`}</span>
                    {isExpanded ? (
                        <ChevronUp size={14} />
                    ) : (
                        <ChevronDown size={14} />
                    )}
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

    if (isLoading) {
        return (
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center space-x-2 mb-4">
                    <div className="w-5 h-5 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
                            <div className="space-y-1">
                                {[1, 2, 3].map((j) => (
                                    <div key={j} className="flex items-center space-x-2">
                                        <div className="w-3 h-3 bg-gray-200 rounded animate-pulse"></div>
                                        <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm sticky top-4">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Filter size={18} className="text-gray-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                    </div>
                    {hasActiveFilters && (
                        <button
                            onClick={clearAllFilters}
                            className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700"
                        >
                            <X size={14} />
                            <span>Clear All</span>
                        </button>
                    )}
                </div>
                {hasActiveFilters && (
                    <p className="text-sm text-primary-600 mt-1">
                        {selectedLevels.length + selectedTags.length + selectedInstructors.length} filter(s) applied
                    </p>
                )}
            </div>

            {/* Filter Content */}
            <div className="p-4 max-h-96 overflow-y-auto">
                <FilterSection
                    title="Level"
                    items={levels}
                    selectedItems={selectedLevels}
                    handleChange={onLevelChange}
                    disabled={levelsDisabled || levels.length === 0}
                />

                <FilterSection
                    title="Topics"
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

            {/* Apply Button - Always Visible */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
                <button
                    onClick={onApplyFilters}
                    disabled={!hasActiveFilters}
                    className={`w-full py-2.5 px-4 text-sm font-medium rounded-md transition-colors ${
                        hasActiveFilters
                            ? "bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                >
                    Apply Filters
                    {hasActiveFilters && (
                        <span className="ml-2 bg-primary-700 text-xs px-2 py-1 rounded-full">
                            {selectedLevels.length + selectedTags.length + selectedInstructors.length}
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default FilterPanel;
