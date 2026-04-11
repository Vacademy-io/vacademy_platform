import { useState, useEffect } from 'react';
import { X, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { InventoryFilters as FiltersType } from '../-types/inventory-types';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

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
    const [searchInput, setSearchInput] = useState(filters.search ?? '');

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== (filters.search ?? '')) {
                onFiltersChange({
                    ...filters,
                    search: searchInput || undefined,
                });
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const hasActiveFilters =
        filters.levelId || filters.sessionId || filters.search;

    const clearAllFilters = () => {
        setSearchInput('');
        onFiltersChange({});
    };

    const removeFilter = (key: keyof FiltersType) => {
        const newFilters = { ...filters };
        delete newFilters[key];
        if (key === 'search') setSearchInput('');
        onFiltersChange(newFilters);
    };

    const getFilterLabel = (key: keyof FiltersType, value: string): string => {
        switch (key) {
            case 'levelId':
                return filterOptions.levels.find((l) => l.id === value)?.name || value;
            case 'sessionId':
                return filterOptions.sessions.find((s) => s.id === value)?.name || value;
            case 'search':
                return `Search: "${value}"`;
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

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search by name..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="h-9 w-[200px] pl-8"
                        />
                    </div>

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
                            <SelectValue placeholder="{`All ${getTerminologyPlural(ContentTerms.Level, SystemTerms.Level)}`}" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">{`All ${getTerminologyPlural(ContentTerms.Level, SystemTerms.Level)}`}</SelectItem>
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
                            <SelectValue placeholder="{`All ${getTerminologyPlural(ContentTerms.Session, SystemTerms.Session)}`}" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">{`All ${getTerminologyPlural(ContentTerms.Session, SystemTerms.Session)}`}</SelectItem>
                            {filterOptions.sessions.map((session) => (
                                <SelectItem key={session.id} value={session.id}>
                                    {session.name}
                                </SelectItem>
                            ))}
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
                                    value && key !== 'availabilityStatus'
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
