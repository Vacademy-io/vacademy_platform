import { X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { InventoryFilters as FiltersType } from '../-types/inventory-types';

interface FilterOption {
    id: string;
    name: string;
}

interface FilterOptionsMap {
    courses: FilterOption[];
    levels: FilterOption[];
    sessions: FilterOption[];
}

interface InventoryFiltersProps {
    filters: FiltersType;
    onFiltersChange: (filters: FiltersType) => void;
    filterOptions: FilterOptionsMap;
}

export const InventoryFilters = ({
    filters,
    onFiltersChange,
    filterOptions,
}: InventoryFiltersProps) => {
    const hasActiveFilters =
        filters.courseId ||
        filters.levelId ||
        filters.sessionId ||
        (filters.availabilityStatus && filters.availabilityStatus !== 'all');

    const clearAllFilters = () => {
        onFiltersChange({});
    };

    const removeFilter = (key: keyof FiltersType) => {
        const newFilters = { ...filters };
        delete newFilters[key];
        onFiltersChange(newFilters);
    };

    const getFilterLabel = (key: keyof FiltersType, value: string): string => {
        switch (key) {
            case 'courseId':
                return filterOptions.courses.find((c) => c.id === value)?.name || value;
            case 'levelId':
                return filterOptions.levels.find((l) => l.id === value)?.name || value;
            case 'sessionId':
                return filterOptions.sessions.find((s) => s.id === value)?.name || value;
            case 'availabilityStatus':
                return value.charAt(0).toUpperCase() + value.slice(1);
            default:
                return value;
        }
    };

    return (
        <Card className="border shadow-sm">
            <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Filter className="size-4" />
                        Filters
                    </div>

                    {/* Course Filter */}
                    <Select
                        value={filters.courseId || '__all__'}
                        onValueChange={(value) =>
                            onFiltersChange({
                                ...filters,
                                courseId: value === '__all__' ? undefined : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-[180px]">
                            <SelectValue placeholder="All Courses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">All Courses</SelectItem>
                            {filterOptions.courses.map((course) => (
                                <SelectItem key={course.id} value={course.id}>
                                    {course.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Level Filter */}
                    <Select
                        value={filters.levelId || '__all__'}
                        onValueChange={(value) =>
                            onFiltersChange({
                                ...filters,
                                levelId: value === '__all__' ? undefined : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-[180px]">
                            <SelectValue placeholder="All Levels" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">All Levels</SelectItem>
                            {filterOptions.levels.map((level) => (
                                <SelectItem key={level.id} value={level.id}>
                                    {level.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Session Filter */}
                    <Select
                        value={filters.sessionId || '__all__'}
                        onValueChange={(value) =>
                            onFiltersChange({
                                ...filters,
                                sessionId: value === '__all__' ? undefined : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-[180px]">
                            <SelectValue placeholder="All Sessions" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">All Sessions</SelectItem>
                            {filterOptions.sessions.map((session) => (
                                <SelectItem key={session.id} value={session.id}>
                                    {session.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Availability Status Filter */}
                    <Select
                        value={filters.availabilityStatus || 'all'}
                        onValueChange={(value) =>
                            onFiltersChange({
                                ...filters,
                                availabilityStatus: value as FiltersType['availabilityStatus'],
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-[180px]">
                            <SelectValue placeholder="Availability" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Availability</SelectItem>
                            <SelectItem value="unlimited">Unlimited</SelectItem>
                            <SelectItem value="limited">Limited</SelectItem>
                            <SelectItem value="low">Low Availability</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Clear All Button */}
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearAllFilters}
                            className="h-9 text-muted-foreground hover:text-foreground"
                        >
                            Clear all
                        </Button>
                    )}
                </div>

                {/* Active Filter Badges */}
                {hasActiveFilters && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                        <span className="text-xs text-muted-foreground">Active:</span>
                        {Object.entries(filters)
                            .filter(
                                ([key, value]) =>
                                    value && (key !== 'availabilityStatus' || value !== 'all')
                            )
                            .map(([key, value]) => (
                                <Badge
                                    key={key}
                                    variant="secondary"
                                    className="cursor-pointer gap-1 pr-1 hover:bg-destructive/20"
                                    onClick={() => removeFilter(key as keyof FiltersType)}
                                >
                                    {getFilterLabel(key as keyof FiltersType, value as string)}
                                    <X className="size-3" />
                                </Badge>
                            ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
