import React, { useState } from "react";
import { Search } from "lucide-react";
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

interface SearchAndSortBarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    sortOption: string;
    onSortChange: (value: string) => void;
}

const SearchAndSortBar: React.FC<SearchAndSortBarProps> = ({
    searchTerm,
    onSearchChange,
    sortOption,
    onSortChange,
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
        <div className="bg-card border border-border rounded-lg shadow-sm p-3 sm:p-4 mb-3 sm:mb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Search Section */}
                <div className="flex-1 min-w-0">
                    <div className="relative">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none"
                        />
                        <Input
                            type="text"
                            placeholder={`Search ${getTerminology(
                                ContentTerms.Course,
                                SystemTerms.Course
                            ).toLocaleLowerCase()}s...`}
                            className="pl-10 w-full"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSearch}
                        />
                    </div>
                </div>

                {/* Sort Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                    <label className="text-sm font-medium whitespace-nowrap hidden sm:block">
                        Sort by:
                    </label>
                    <div className="w-full sm:w-[150px]">
                        <Select value={sortOption} onValueChange={onSortChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Sort order" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Newest">Newest First</SelectItem>
                                <SelectItem value="Oldest">Oldest First</SelectItem>
                                {/* <SelectItem value="Popularity">Most Popular</SelectItem>
                <SelectItem value="Rating">Highest Rated</SelectItem> */}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchAndSortBar;
