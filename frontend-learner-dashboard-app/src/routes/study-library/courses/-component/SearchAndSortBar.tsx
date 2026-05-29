import React, { useState } from "react";
import { MagnifyingGlass, ArrowsDownUp, SlidersHorizontal } from "@phosphor-icons/react";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SearchAndSortBarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    sortOption: string;
    onSortChange: (value: string) => void;
    showFilterToggle?: boolean;
    isFilterOpen?: boolean;
    onFilterToggle?: () => void;
    activeFiltersCount?: number;
}

const SearchAndSortBar: React.FC<SearchAndSortBarProps> = ({
    searchTerm,
    onSearchChange,
    sortOption,
    onSortChange,
    showFilterToggle = false,
    isFilterOpen = false,
    onFilterToggle,
    activeFiltersCount = 0,
}) => {
    const [inputValue, setInputValue] = useState(searchTerm);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            onSearchChange(inputValue);
        }
    };

    const handleSearch = () => {
        onSearchChange(inputValue);
    };

    return (
        <div className={cn(
            "bg-card border border-border rounded-lg shadow-sm p-3 sm:p-4 mb-3 sm:mb-4",
            // Vibrant Styles - Flat Pastel
            "[.ui-vibrant_&]:bg-slate-50/50 dark:[.ui-vibrant_&]:bg-slate-900/20",
            "[.ui-vibrant_&]:border-slate-200/50 dark:[.ui-vibrant_&]:border-slate-800/30",
            "[.ui-vibrant_&]:shadow-sm",
            // Play Styles — soft shadow + thin border via play-theme.css fallback
            "[.ui-play_&]:!bg-white [.ui-play_&]:rounded-2xl [.ui-play_&]:border [.ui-play_&]:!border-primary-100",
            "[.ui-play_&]:shadow-play-glow-primary"
        )}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Filter toggle — desktop only, only shown when filter is closed */}
                {showFilterToggle && onFilterToggle && !isFilterOpen && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onFilterToggle}
                        className={cn(
                            "hidden lg:flex items-center gap-1.5 shrink-0 h-9",
                            "[.ui-vibrant_&]:border-primary/30 [.ui-vibrant_&]:hover:bg-primary/5",
                        )}
                    >
                        <SlidersHorizontal size={15} />
                        <span className="text-sm">Filters</span>
                        {activeFiltersCount > 0 && (
                            <Badge variant="secondary" className="h-4 px-1 text-caption leading-none ml-0.5">
                                {activeFiltersCount}
                            </Badge>
                        )}
                    </Button>
                )}
                {/* Search Section */}
                <div className="flex-1 min-w-0">
                    <div className="relative">
                        <MagnifyingGlass
                            size={18}
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none"
                        />
                        <Input
                            type="text"
                            placeholder={`Search ${getTerminology(
                                ContentTerms.Course,
                                SystemTerms.Course
                            ).toLocaleLowerCase()}s...`}
                            className={cn("pl-10 w-full", "[.ui-play_&]:rounded-full [.ui-play_&]:border-2 [.ui-play_&]:border-primary-200 [.ui-play_&]:bg-primary-50 [.ui-play_&]:font-bold")}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSearch}
                        />
                    </div>
                </div>

                {/* Sort Section */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
                    <label className="text-sm font-medium whitespace-nowrap hidden sm:block">
                        Sort by:
                    </label>
                    <ArrowsDownUp
                        size={16}
                        className="text-muted-foreground shrink-0 sm:hidden"
                        aria-hidden="true"
                    />
                    <div className="flex-1 sm:w-44 sm:flex-none">
                        <Select value={sortOption} onValueChange={onSortChange}>
                            <SelectTrigger aria-label="Sort courses">
                                <SelectValue placeholder="Sort order" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Newest">Newest First</SelectItem>
                                <SelectItem value="Oldest">Oldest First</SelectItem>
                                <SelectItem value="HighestRated">Highest Rated</SelectItem>
                                <SelectItem value="Shortest">Shortest First</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchAndSortBar;
