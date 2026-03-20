import { useState, useEffect, useCallback } from 'react';
import { useSearch } from '@tanstack/react-router';
import { ContactListRequest } from '../-types/contact-types';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

export const useContactFilters = () => {
    const searchParams = useSearch({ strict: false }) as Record<string, any>;
    const [searchInput, setSearchInput] = useState<string>('');
    const [searchFilter, setSearchFilter] = useState('');
    const [columnFilters, setColumnFilters] = useState<
        { id: string; value: { id: string; label: string }[] }[]
    >([]);

    const [appliedFilters, setAppliedFilters] = useState<ContactListRequest>({
        institute_id: getCurrentInstituteId() || "",
        page: 0,
        size: 10,
        include_institute_users: true,
        include_audience_respondents: true,
        user_filter: {},
        campaign_filter: {},
    });

    const [clearFilters, setClearFilters] = useState<boolean>(false);

    // Initialize from URL
    useEffect(() => {
        const initialFilters: { id: string; value: { id: string; label: string }[] }[] = [];

        if (searchParams.name) {
            setSearchInput(searchParams.name);
            setSearchFilter(searchParams.name);
        }

        if (searchParams.gender) {
            const genders = Array.isArray(searchParams.gender) ? searchParams.gender : [searchParams.gender];
            const genderOptions = genders.map((g: string) => ({ id: g, label: g }));
            initialFilters.push({ id: 'gender', value: genderOptions });
        }

        if (searchParams.source) {
            const sources = Array.isArray(searchParams.source) ? searchParams.source : [searchParams.source];
            const sourceOptions = sources.map((s: string) => ({
                id: s,
                label: s === 'INSTITUTE' ? 'Institute Users' : 'Audience Respondents'
            }));
            initialFilters.push({ id: 'source', value: sourceOptions });
        }

        // Add more URL params parsing here if needed (region, etc)

        if (initialFilters.length > 0) {
            setColumnFilters(initialFilters);
            setClearFilters(false);

            // Calculate sources based on URL
            const sourceFilter = initialFilters.find(f => f.id === 'source');
            const sourceIds = sourceFilter?.value.map(v => v.id) || [];
            const includeInst = sourceIds.length > 0 ? sourceIds.includes('INSTITUTE') : true;
            const includeAud = sourceIds.length > 0 ? sourceIds.includes('AUDIENCE') : true;

            setAppliedFilters(prev => ({
                ...prev,
                include_institute_users: includeInst,
                include_audience_respondents: includeAud,
                user_filter: {
                    ...prev.user_filter,
                    name_search: searchParams.name,
                    genders: searchParams.gender ? (Array.isArray(searchParams.gender) ? searchParams.gender : [searchParams.gender]) : undefined
                }
            }));
        }
    }, [searchParams]);

    const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(event.target.value);
    };

    const handleSearchEnter = () => {
        setSearchFilter(searchInput);
        const currentParams = new URLSearchParams(window.location.search);
        if (searchInput) {
            currentParams.set('name', searchInput);
        } else {
            currentParams.delete('name');
        }
        const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
        window.history.replaceState({}, '', newUrl);

        setAppliedFilters((prev) => ({
            ...prev,
            user_filter: {
                ...prev.user_filter,
                name_search: searchInput,
            },
            page: 0 // reset page on search
        }));
    };

    const handleClearSearch = () => {
        setSearchInput('');
        setSearchFilter('');
        const currentParams = new URLSearchParams(window.location.search);
        currentParams.delete('name');
        window.history.replaceState({}, '', `${window.location.pathname}?${currentParams.toString()}`);

        setAppliedFilters((prev) => ({
            ...prev,
            user_filter: {
                ...prev.user_filter,
                name_search: '',
            }
        }));
    };

    const handleFilterChange = (filterId: string, options: { id: string; label: string }[]) => {
        setColumnFilters((prev) => {
            const existing = prev.filter((f) => f.id !== filterId);
            if (options.length === 0) return existing;
            return [...existing, { id: filterId, value: options }];
        });
    };

    const handleFilterClick = () => {
        const genderFilter = columnFilters.find(f => f.id === 'gender');
        const genders = genderFilter?.value.map(v => v.id);

        const sourceFilter = columnFilters.find(f => f.id === 'source');
        const sourceIds = sourceFilter?.value.map(v => v.id) || [];

        // If filter is active, use selection. If not active (empty), default to true for both.
        // Wait, if user deselects all in UI, it implies "None"? Or "All"?
        // Typically with filters: No selection = All.
        const includeInst = sourceIds.length > 0 ? sourceIds.includes('INSTITUTE') : true;
        const includeAud = sourceIds.length > 0 ? sourceIds.includes('AUDIENCE') : true;

        const currentParams = new URLSearchParams(window.location.search);

        currentParams.delete('gender');
        genders?.forEach(g => currentParams.append('gender', g));

        currentParams.delete('source');
        sourceIds?.forEach(s => currentParams.append('source', s));

        if (searchFilter) {
            currentParams.set('name', searchFilter);
        }

        window.history.replaceState({}, '', `${window.location.pathname}?${currentParams.toString()}`);

        setAppliedFilters((prev) => ({
            ...prev,
            include_institute_users: includeInst,
            include_audience_respondents: includeAud,
            user_filter: {
                ...prev.user_filter,
                name_search: searchFilter,
                genders: genders
            },
            page: 0
        }));
    };

    const handleClearFilters = () => {
        setClearFilters(true);
        setColumnFilters([]);
        setSearchFilter('');
        setSearchInput('');

        const currentParams = new URLSearchParams(window.location.search);
        currentParams.delete('name');
        currentParams.delete('gender');
        window.history.replaceState({}, '', `${window.location.pathname}?${currentParams.toString()}`);

        setAppliedFilters({
            institute_id: getCurrentInstituteId() || "",
            page: 0,
            size: 10,
            include_institute_users: true,
            include_audience_respondents: true,
            user_filter: {},
            campaign_filter: {},
        });
    };

    const getActiveFiltersState = useCallback(() => {
        const genderFilter = columnFilters.find((filter) => filter.id === 'gender');
        const hasName = Boolean(appliedFilters.user_filter?.name_search?.trim());
        const hasGender = Boolean(genderFilter?.value && genderFilter.value.length > 0);
        return hasName || hasGender;
    }, [columnFilters, appliedFilters]);

    return {
        searchInput,
        searchFilter,
        columnFilters,
        appliedFilters,
        setAppliedFilters,
        handleSearchInputChange,
        handleSearchEnter,
        handleClearSearch,
        handleFilterChange,
        handleFilterClick,
        handleClearFilters,
        getActiveFiltersState,
        clearFilters
    };
};
