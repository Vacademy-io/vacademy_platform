import { useState, useEffect, useCallback } from 'react';
import { useSearch } from '@tanstack/react-router';
import { ContactListRequest } from '../-types/contact-types';
import { decodeSelectionToEntries } from '@/components/shared/leads/custom-field-filter-encoding';
import { readUtmSelection, toUtmFiltersPayload } from '@/components/shared/leads/utm-filter-encoding';
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

        if (searchParams.status) {
            const statuses = Array.isArray(searchParams.status) ? searchParams.status : [searchParams.status];
            const statusOptions = statuses.map((s: string) => ({ id: s, label: s }));
            initialFilters.push({ id: 'statuses', value: statusOptions });
        }

        if (searchParams.batch) {
            const batches = Array.isArray(searchParams.batch) ? searchParams.batch : [searchParams.batch];
            const batchOptions = batches.map((b: string) => ({ id: b, label: b }));
            initialFilters.push({ id: 'batch', value: batchOptions });
        }

        if (searchParams.audience) {
            const audiences = Array.isArray(searchParams.audience) ? searchParams.audience : [searchParams.audience];
            const audienceOptions = audiences.map((a: string) => ({ id: a, label: a }));
            initialFilters.push({ id: 'audience_list', value: audienceOptions });
        }

        if (initialFilters.length > 0) {
            setColumnFilters(initialFilters);
            setClearFilters(false);

            const newApplied = buildAppliedFilters(initialFilters, searchParams.name || '');
            setAppliedFilters(prev => ({ ...prev, ...newApplied }));
        }
    }, [searchParams]);

    const buildAppliedFilters = (
        filters: { id: string; value: { id: string; label: string }[] }[],
        nameSearch: string
    ): Partial<ContactListRequest> => {
        // Source filter
        const sourceFilter = filters.find(f => f.id === 'source');
        const sourceIds = sourceFilter?.value.map(v => v.id) || [];
        const includeInst = sourceIds.length > 0 ? sourceIds.includes('INSTITUTE') : true;
        const includeAud = sourceIds.length > 0 ? sourceIds.includes('AUDIENCE') : true;

        // Gender filter
        const genderFilter = filters.find(f => f.id === 'gender');
        const genders = genderFilter?.value.map(v => v.label);

        // Status filter (enrollment status for institute users)
        const statusFilter = filters.find(f => f.id === 'statuses');
        const statuses = statusFilter?.value.map(v => v.label);

        // Batch filter (package session IDs)
        const batchFilter = filters.find(f => f.id === 'batch');
        const packageSessionIds = batchFilter?.value.map(v => v.id);

        // Membership filter (Trial / Paid). Learner-only by nature: the backend drops the
        // audience half of its union whenever this is set, because a lead has no plan.
        const membershipFilter = filters.find(f => f.id === 'membership');
        const membershipTypes = membershipFilter?.value.map(v => v.id);

        // Joined-month cohorts. Each option carries an id of "YYYY-MM"; several may be
        // picked, and the payload is the span from the earliest to the latest selected
        // month. A single range cannot express "September OR November", so a gap in the
        // selection widens to include the months between rather than silently dropping one.
        const joinedFilter = filters.find(f => f.id === 'joined');
        const joinedMonths = (joinedFilter?.value.map(v => v.id) ?? []).filter(Boolean).sort();
        const enrolledDateFrom = joinedMonths.length > 0 ? `${joinedMonths[0]}-01` : undefined;
        const enrolledDateTo = joinedMonths.length > 0 ? lastDayOfMonth(joinedMonths[joinedMonths.length - 1]!) : undefined;

        // Audience list filter
        const audienceFilter = filters.find(f => f.id === 'audience_list');
        const audienceIds = audienceFilter?.value.map(v => v.id);

        // When filtering by specific audience, only show audience respondents
        const hasAudienceFilter = audienceIds && audienceIds.length > 0;

        // Custom-field filters live in columnFilters under `cf:<custom_field_id>`
        // (set by the multi-select / range dropdowns in the filter bar). Sentinel
        // values (contains / empty / ranges) decode into operator entries; plain
        // values stay an IN entry. The backend ANDs across entries and matches
        // either the contact's learner answer or any of their lead answers.
        const customFieldFilters = filters
            .filter((f) => f.id.startsWith('cf:') && f.value.length > 0)
            .flatMap((f) =>
                decodeSelectionToEntries(
                    f.id.slice(3),
                    f.value.map((v) => v.id)
                )
            );

        return {
            include_institute_users: hasAudienceFilter ? false : includeInst,
            include_audience_respondents: includeAud,
            user_filter: {
                name_search: nameSearch || undefined,
                genders: genders,
            },
            statuses: statuses && statuses.length > 0 ? statuses : undefined,
            membership_types: membershipTypes && membershipTypes.length > 0 ? membershipTypes : undefined,
            enrolled_date_from: enrolledDateFrom,
            enrolled_date_to: enrolledDateTo,
            package_session_ids: packageSessionIds && packageSessionIds.length > 0 ? packageSessionIds : undefined,
            campaign_filter: audienceIds && audienceIds.length > 0 ? { audience_ids: audienceIds } : {},
            custom_field_filters: customFieldFilters.length > 0 ? customFieldFilters : undefined,
            // Campaign (UTM) filters ride columnFilters under `utm:<dimension>`
            // (set by the UtmFilterControls dropdowns) and apply with the same
            // Apply button. Undefined when nothing is selected.
            utm_filters: toUtmFiltersPayload(readUtmSelection(filters)),
            page: 0,
        };
    };

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
            page: 0
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
        const newApplied = buildAppliedFilters(columnFilters, searchFilter);

        // Update URL
        const currentParams = new URLSearchParams(window.location.search);
        ['gender', 'source', 'status', 'batch', 'audience', 'name'].forEach(k => currentParams.delete(k));

        if (searchFilter) currentParams.set('name', searchFilter);

        const genderFilter = columnFilters.find(f => f.id === 'gender');
        genderFilter?.value.forEach(g => currentParams.append('gender', g.label));

        const sourceFilter = columnFilters.find(f => f.id === 'source');
        sourceFilter?.value.forEach(s => currentParams.append('source', s.id));

        const statusFilter = columnFilters.find(f => f.id === 'statuses');
        statusFilter?.value.forEach(s => currentParams.append('status', s.label));

        const batchFilter = columnFilters.find(f => f.id === 'batch');
        batchFilter?.value.forEach(b => currentParams.append('batch', b.id));

        const audienceFilter = columnFilters.find(f => f.id === 'audience_list');
        audienceFilter?.value.forEach(a => currentParams.append('audience', a.id));

        window.history.replaceState({}, '', `${window.location.pathname}?${currentParams.toString()}`);

        setAppliedFilters((prev) => ({
            ...prev,
            ...newApplied,
        }));
    };

    const handleClearFilters = () => {
        setClearFilters(true);
        setColumnFilters([]);
        setSearchFilter('');
        setSearchInput('');

        const currentParams = new URLSearchParams(window.location.search);
        ['name', 'gender', 'source', 'status', 'batch', 'audience'].forEach(k => currentParams.delete(k));
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
        const hasName = Boolean(String(appliedFilters.user_filter?.name_search ?? '').trim());
        const hasColumnFilter = columnFilters.some(f => f.value && f.value.length > 0);
        return hasName || hasColumnFilter;
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

/** Last calendar day of a "YYYY-MM" month, as YYYY-MM-DD. */
function lastDayOfMonth(month: string): string {
    const [year, mon] = month.split('-').map(Number);
    // Day 0 of the NEXT month is the last day of this one, which keeps February and leap
    // years correct without a table of month lengths.
    const d = new Date(Date.UTC(year!, mon!, 0));
    return d.toISOString().slice(0, 10);
}
