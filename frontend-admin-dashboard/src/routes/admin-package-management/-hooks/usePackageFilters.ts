import { useState, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Route } from '../index';
import { PackageFilterRequest } from '../-types/package-types';

export interface FilterOption {
    id: string;
    label: string;
}

export interface ColumnFilter {
    id: string;
    value: FilterOption[];
}

export const usePackageFilters = () => {
    const navigate = useNavigate();
    const searchParams = useSearch({ from: Route.id });

    const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]);
    const [searchInput, setSearchInput] = useState<string>(searchParams.search || '');
    const [searchFilter, setSearchFilter] = useState<string>(searchParams.search || '');
    const [clearFilters, setClearFilters] = useState<boolean>(false);
    const [page, setPage] = useState<number>(searchParams.page || 0);

    const [appliedFilters, setAppliedFilters] = useState<PackageFilterRequest>({
        page: searchParams.page || 0,
        size: 20,
        sessionId: searchParams.sessionId,
        levelId: searchParams.levelId,
        packageId: searchParams.packageId,
        search: searchParams.search,
        statuses: searchParams.status
            ? Array.isArray(searchParams.status)
                ? searchParams.status
                : [searchParams.status]
            : ['ACTIVE'],
        sortBy: searchParams.sortBy || 'created_at',
        sortDirection: searchParams.sortDirection || 'DESC',
    });

    const handleFilterChange = (filterId: string, values: FilterOption[]) => {
        setColumnFilters((prev) => {
            const existingIndex = prev.findIndex((f) => f.id === filterId);
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = { id: filterId, value: values };
                return updated;
            }
            return [...prev, { id: filterId, value: values }];
        });
    };

    const handleFilterClick = () => {
        const sessionFilter = columnFilters.find((f) => f.id === 'session');
        const levelFilter = columnFilters.find((f) => f.id === 'level');
        const packageFilter = columnFilters.find((f) => f.id === 'package');
        const statusFilter = columnFilters.find((f) => f.id === 'status');

        const newFilters: PackageFilterRequest = {
            page: 0,
            size: 20,
            sessionId: sessionFilter?.value[0]?.id,
            levelId: levelFilter?.value[0]?.id,
            packageId: packageFilter?.value[0]?.id,
            search: searchFilter,
            statuses: statusFilter?.value.map((v) => v.id) || ['ACTIVE'],
            sortBy: appliedFilters.sortBy,
            sortDirection: appliedFilters.sortDirection,
        };

        setAppliedFilters(newFilters);
        setPage(0);
        updateUrlParams(newFilters);
    };

    const handleClearFilters = () => {
        setClearFilters(true);
        setColumnFilters([]);
        setSearchFilter('');
        setSearchInput('');
        setPage(0);

        const newFilters: PackageFilterRequest = {
            page: 0,
            size: 20,
            statuses: ['ACTIVE'],
            sortBy: 'created_at',
            sortDirection: 'DESC',
        };

        setAppliedFilters(newFilters);

        navigate({
            to: '/admin-package-management',
            search: {},
            replace: true,
        });

        setTimeout(() => setClearFilters(false), 100);
    };

    const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(event.target.value);
    };

    const handleSearchEnter = () => {
        setSearchFilter(searchInput);
        setPage(0);

        const newFilters = {
            ...appliedFilters,
            search: searchInput,
            page: 0,
        };

        setAppliedFilters(newFilters);
        updateUrlParams(newFilters);
    };

    const handleClearSearch = () => {
        setSearchInput('');
        setSearchFilter('');

        const newFilters = {
            ...appliedFilters,
            search: undefined,
        };

        setAppliedFilters(newFilters);
        updateUrlParams(newFilters);
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        const newFilters = {
            ...appliedFilters,
            page: newPage,
        };
        setAppliedFilters(newFilters);
        updateUrlParams(newFilters);
    };

    const handleSort = (sortBy: string, sortDirection: 'ASC' | 'DESC') => {
        const newFilters = {
            ...appliedFilters,
            sortBy,
            sortDirection,
            page: 0,
        };
        setAppliedFilters(newFilters);
        setPage(0);
        updateUrlParams(newFilters);
    };

    const updateUrlParams = (filters: PackageFilterRequest) => {
        const search: Record<string, any> = {};

        if (filters.sessionId) search.sessionId = filters.sessionId;
        if (filters.levelId) search.levelId = filters.levelId;
        if (filters.packageId) search.packageId = filters.packageId;
        if (filters.search) search.search = filters.search;
        if (
            filters.statuses &&
            filters.statuses.length > 0 &&
            !(filters.statuses.length === 1 && filters.statuses[0] === 'ACTIVE')
        ) {
            search.status = filters.statuses;
        }
        if (filters.sortBy && filters.sortBy !== 'created_at') search.sortBy = filters.sortBy;
        if (filters.sortDirection && filters.sortDirection !== 'DESC')
            search.sortDirection = filters.sortDirection;
        if (filters.page && filters.page > 0) search.page = filters.page;

        navigate({
            to: '/admin-package-management',
            search,
            replace: true,
        });
    };

    const getActiveFiltersState = useCallback(() => {
        const hasSession = columnFilters.some((f) => f.id === 'session' && f.value.length > 0);
        const hasLevel = columnFilters.some((f) => f.id === 'level' && f.value.length > 0);
        const hasPackage = columnFilters.some((f) => f.id === 'package' && f.value.length > 0);
        const hasStatus = columnFilters.some((f) => f.id === 'status' && f.value.length > 0);
        const hasSearch = Boolean(searchFilter?.trim());

        return hasSession || hasLevel || hasPackage || hasStatus || hasSearch;
    }, [columnFilters, searchFilter]);

    return {
        columnFilters,
        appliedFilters,
        clearFilters,
        searchInput,
        searchFilter,
        page,
        getActiveFiltersState,
        handleFilterChange,
        handleFilterClick,
        handleClearFilters,
        handleSearchInputChange,
        handleSearchEnter,
        handleClearSearch,
        handlePageChange,
        handleSort,
        setColumnFilters,
        setAppliedFilters,
    };
};
