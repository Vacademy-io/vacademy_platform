import React, { useState } from "react";
import { useCatalogStore } from "../-store/catalogStore";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleFetchInstituteDetails } from "../-services/institute-details";
import { FunnelSimple, CheckCircle, MagnifyingGlass, User, Tag } from 'phosphor-react';
import { ChevronDown, ChevronUp } from 'lucide-react';

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

    const getIcon = () => {
        switch (title) {
            case "Level":
                return <MagnifyingGlass size={16} weight="duotone" className="text-primary-600" />;
            case "Popular Topics":
                return <Tag size={16} weight="duotone" className="text-primary-600" />;
            case "Instructors":
                return <User size={16} weight="duotone" className="text-primary-600" />;
            default:
                return <CheckCircle size={16} weight="duotone" className="text-primary-600" />;
        }
    };

    return (
        <div className="mb-4 sm:mb-5 bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl p-3 sm:p-4 hover:shadow-lg transition-all duration-300 group animate-fade-in-up">
            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none"></div>
            
            <div className="relative">
                {/* Section Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg shadow-sm">
                            {getIcon()}
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-gray-900">
                            {title}
                        </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                        {selectedItems.length > 0 && (
                            <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded-full">
                                {selectedItems.length}
                            </span>
                        )}
                    </div>
                </div>

                {/* Filter Items */}
                <div className="space-y-1.5">
                    {items.length === 0 && !disabled && (
                        <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <p className="text-sm text-gray-500 font-medium">
                                No {title.toLowerCase()} available
                            </p>
                        </div>
                    )}
                    {disabled && (
                        <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <p className="text-sm text-gray-500 font-medium">
                                {title} filters are currently unavailable
                            </p>
                        </div>
                    )}
                    {itemsToDisplay.map((item, index) => (
                        <label
                            key={item.id}
                            className={`group/item relative flex items-center p-2.5 rounded-lg transition-all duration-300 ${
                                disabled
                                    ? "cursor-not-allowed opacity-50"
                                    : "cursor-pointer hover:bg-primary-50/50 hover:shadow-sm"
                            } ${selectedItems.includes(item.id) ? "bg-primary-50/80 border border-primary-200" : "bg-gray-50/50 border border-gray-100"}`}
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            <div className="relative flex-shrink-0">
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={selectedItems.includes(item.id)}
                                    onChange={() => handleChange(item.id)}
                                    disabled={disabled}
                                />
                                <div className={`w-5 h-5 rounded-md border-2 transition-all duration-300 flex items-center justify-center ${
                                    selectedItems.includes(item.id) 
                                        ? "border-primary-500 bg-primary-500" 
                                        : "border-gray-300 bg-white group-hover/item:border-primary-300"
                                }`}>
                                    {selectedItems.includes(item.id) && (
                                        <CheckCircle size={12} weight="fill" className="text-white" />
                                    )}
                                </div>
                            </div>
                            <span className={`ml-3 text-sm font-medium transition-colors duration-300 ${
                                selectedItems.includes(item.id) 
                                    ? "text-primary-700" 
                                    : "text-gray-700 group-hover/item:text-gray-900"
                            }`}>
                                {item.name}
                            </span>
                            
                            {/* Hover indicator */}
                            <div className="absolute inset-0 bg-gradient-to-r from-primary-400/10 to-primary-600/10 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 rounded-lg pointer-events-none"></div>
                        </label>
                    ))}
                </div>

                {/* Expand/Collapse Button */}
                {canExpand && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        disabled={disabled}
                        className={`w-full mt-4 p-2 text-sm font-semibold rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
                            disabled
                                ? "text-gray-400 cursor-not-allowed bg-gray-100"
                                : "text-primary-600 hover:text-primary-700 bg-primary-50/50 hover:bg-primary-100/70 border border-primary-200 hover:shadow-sm"
                        }`}
                    >
                        <span>{isExpanded ? "Show Less" : "Show More"}</span>
                        {isExpanded ? (
                            <ChevronUp size={16} className="transition-transform duration-300" />
                        ) : (
                            <ChevronDown size={16} className="transition-transform duration-300" />
                        )}
                    </button>
                )}
            </div>
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

    if (isLoading) return (
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl p-6 shadow-sm animate-pulse">
            <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gray-200 rounded-xl"></div>
                <div className="h-6 bg-gray-200 rounded w-24"></div>
            </div>
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-gray-100 rounded-xl p-4">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                        <div className="space-y-2">
                            {[1, 2, 3].map((j) => (
                                <div key={j} className="flex items-center space-x-3">
                                    <div className="w-4 h-4 bg-gray-200 rounded"></div>
                                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-500 overflow-hidden w-full max-w-full">
            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 via-transparent to-primary-50/20 pointer-events-none"></div>
            
            {/* Floating orb effect */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary-100/20 rounded-full blur-2xl opacity-70 -translate-y-2 translate-x-4"></div>
            
            <div className="relative p-2 sm:p-3">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4 animate-fade-in-down">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl shadow-sm">
                            <FunnelSimple size={24} className="text-primary-600" weight="duotone" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Filters</h2>
                            <p className="text-sm text-gray-600 mt-1 flex items-center space-x-2">
                                <span>Refine your search</span>
                                {hasActiveFilters && (
                                    <>
                                        <span>•</span>
                                        <span className="text-primary-600 font-medium">
                                            {selectedLevels.length + selectedTags.length + selectedInstructors.length} active
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3 sm:space-x-2">
                        <button
                            onClick={clearAllFilters}
                            disabled={!hasActiveFilters}
                            className={`relative overflow-hidden px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 min-w-[100px] ${
                                hasActiveFilters
                                    ? "text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border-2 border-gray-300 hover:border-gray-400 shadow-md hover:shadow-lg"
                                    : "text-gray-400 bg-gray-100 border-2 border-gray-200 cursor-not-allowed"
                            }`}
                        >
                            Clear All
                        </button>
                        <button
                            onClick={onApplyFilters}
                            disabled={!hasActiveFilters}
                            className={`relative overflow-hidden px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 min-w-[120px] ${
                                hasActiveFilters
                                    ? "text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-lg hover:shadow-xl transform hover:scale-105 border-2 border-primary-600"
                                    : "text-gray-400 bg-gray-100 border-2 border-gray-200 cursor-not-allowed"
                            }`}
                        >
                            {/* Shimmer effect for active state */}
                            {hasActiveFilters && (
                                <div className="absolute inset-0 -skew-x-12 -translate-x-full hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700"></div>
                            )}
                            Apply Filters
                        </button>
                    </div>
                </div>

                {/* Filter Sections */}
                <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
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
            </div>
        </div>
    );
};

export default FilterPanel;
