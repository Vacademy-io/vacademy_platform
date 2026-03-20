import { MyButton } from '@/components/design-system/button';
import { Funnel, X } from '@phosphor-icons/react';
import { Filters } from '@/routes/manage-students/students-list/-components/students-list/student-list-section/myFilter';
import { StudentSearchBox } from '@/components/common/student-search-box';
import { useContactFilters } from '../-hooks/useContactFilters';

interface ContactFiltersProps {
    filters: {
        searchInput: string;
        searchFilter: string;
        columnFilters: { id: string; value: { id: string; label: string }[] }[];
        handleSearchInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
        handleSearchEnter: () => void;
        handleClearSearch: () => void;
        handleFilterChange: (filterId: string, values: { id: string; label: string }[]) => void;
        handleFilterClick: () => void;
        handleClearFilters: () => void;
        getActiveFiltersState: () => boolean;
        clearFilters: boolean;
    };
}

export const ContactFilters = ({ filters }: ContactFiltersProps) => {
    const {
        searchInput,
        searchFilter,
        columnFilters,
        handleSearchInputChange,
        handleSearchEnter,
        handleClearSearch,
        handleFilterChange,
        handleFilterClick,
        handleClearFilters,
        getActiveFiltersState,
        clearFilters,
    } = filters;

    const filterConfig = [
        {
            id: 'gender',
            title: 'Gender',
            filterList: [
                { id: 'MALE', label: 'Male' },
                { id: 'FEMALE', label: 'Female' },
                { id: 'OTHER', label: 'Other' },
            ],
        },
        {
            id: 'source',
            title: 'Source',
            filterList: [
                { id: 'INSTITUTE', label: 'Institute Users' },
                { id: 'AUDIENCE', label: 'Audience Respondents' },
            ],
        },
    ];

    return (
        <div className="animate-fadeIn space-y-4">
            <div className="rounded-xl border border-neutral-200/50 bg-gradient-to-r from-white to-neutral-50/30 p-4 shadow-sm">
                <div className="flex flex-col gap-4">
                    <div className="w-full lg:max-w-md">
                        <StudentSearchBox
                            searchInput={searchInput}
                            searchFilter={searchFilter}
                            onSearchChange={handleSearchInputChange}
                            onSearchEnter={handleSearchEnter}
                            onClearSearch={handleClearSearch}
                            placeholder="Search by name"
                        />
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {filterConfig.map((filter, index) => (
                            <div
                                key={filter.id}
                                className="animate-slideInRight"
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <Filters
                                    filterDetails={{
                                        label: filter.title,
                                        filters: filter.filterList,
                                    }}
                                    onFilterChange={(values) => handleFilterChange(filter.id, values)}
                                    clearFilters={clearFilters}
                                    filterId={filter.id}
                                    columnFilters={columnFilters}
                                />
                            </div>
                        ))}
                    </div>

                    {(columnFilters.length > 0 || getActiveFiltersState()) && (
                        <div className="animate-scaleIn flex flex-wrap items-center gap-3 border-t border-neutral-200/50 pt-2">
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                layoutVariant="default"
                                className="hover:scale-102 to-primary-600 hover:from-primary-600 hover:to-primary-700 group flex h-8 items-center gap-2 bg-gradient-to-r from-primary-500 shadow-md transition-all duration-200"
                                onClick={handleFilterClick}
                            >
                                <Funnel className="size-3.5 transition-transform duration-200 group-hover:scale-110" />
                                Apply Filters
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="default"
                                className="hover:scale-102 group flex h-8 items-center gap-2 border border-neutral-300 bg-neutral-100 transition-all duration-200 hover:border-neutral-400 hover:bg-neutral-200 active:border-neutral-500 active:bg-neutral-300"
                                onClick={handleClearFilters}
                            >
                                <X className="size-3.5 transition-transform duration-200 group-hover:scale-110" />
                                Reset All
                            </MyButton>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
