import { useState, useEffect, useCallback } from 'react';
import { StudentFilterRequest } from '@/types/student-table-types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useSelectedSessionStore } from '@/stores/study-library/selected-session-store';
import {
    DropdownItemType,
    DropdownValueType,
} from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';

export const useStudentFilters = () => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    const { getAllSessions, instituteDetails } = useInstituteDetailsStore();
    const { selectedSession, setSelectedSession } = useSelectedSessionStore();
    const [columnFilters, setColumnFilters] = useState<
        { id: string; value: { id: string; label: string }[] }[]
    >([]);
    const [searchInput, setSearchInput] = useState<string>('');
    const [searchFilter, setSearchFilter] = useState('');
    const [clearFilters, setClearFilters] = useState<boolean>(false);
    const [sessionList, setSessionList] = useState<DropdownItemType[]>(
        getAllSessions().map((session) => ({
            id: session.id,
            name: session.session_name,
        }))
    );
    const [currentSession, setCurrentSession] = useState<DropdownItemType>(() => {
        const defaultSession = sessionList[0] || { id: '', name: '' };
        return selectedSession && sessionList.find((session) => session.id === selectedSession.id)
            ? { id: selectedSession.id, name: selectedSession.session_name }
            : defaultSession;
    });

    useEffect(() => {
        setSessionList(
            getAllSessions().map((session) => ({
                id: session.id,
                name: session.session_name,
            }))
        );
        if (currentSession && sessionList.includes(currentSession)) {
            const session = getAllSessions().find((session) => session.id === currentSession.id);
            if (session) {
                setSelectedSession(session);
            }
        } else {
            const defaultSession = sessionList[0] || { id: '', name: '' };
            const newSession = selectedSession
                ? { id: selectedSession.id, name: selectedSession.session_name }
                : defaultSession;
            setCurrentSession(newSession);
            const session = getAllSessions().find((session) => session.id === newSession.id);
            if (session) {
                setSelectedSession(session);
            }
        }
    }, [instituteDetails]);

    const [allPackageSessionIds, setAllPackageSessionIds] = useState<string[]>([]);

    const [appliedFilters, setAppliedFilters] = useState<StudentFilterRequest>({
        name: '',
        institute_ids: INSTITUTE_ID ? [INSTITUTE_ID] : [],
        package_session_ids: allPackageSessionIds,
        group_ids: [],
        gender: [],
        statuses: instituteDetails?.student_statuses || [],
        session_expiry_days: [],
        sort_columns: {},
    });

    useEffect(() => {
        const pksIds =
            columnFilters
                .find((filter) => filter.id === 'batch')
                ?.value.map((option) => option.id) ||
            (instituteDetails?.batches_for_sessions || [])
                .filter((batch) => batch.session.id === currentSession.id)
                .map((batch) => batch.id);

        setAllPackageSessionIds(pksIds);

        if (currentSession) {
            setAppliedFilters((prev) => ({
                ...prev,
                package_session_ids: pksIds,
            }));
        }
    }, [currentSession]);

    useEffect(() => {
        if (columnFilters.length === 0) {
            setClearFilters(false);
        }
    }, [columnFilters.length]);

    const handleSessionChange = (value: DropdownValueType) => {
        if (value && typeof value === 'object' && 'id' in value && 'name' in value) {
            setCurrentSession(value as DropdownItemType);
            const session = getAllSessions().find(
                (session) => session.id === (value as DropdownItemType).id
            );
            if (session) {
                setSelectedSession(session);
            }
        }
    };

    const handleFilterChange = (filterId: string, options: { id: string; label: string }[]) => {
        setColumnFilters((prev) => {
            const existing = prev.filter((f) => f.id !== filterId);
            if (options.length === 0 && filterId === 'statuses') {
                // If clearing status filter, use all API-provided statuses
                return existing;
            }
            if (options.length === 0) return existing;
            return [...existing, { id: filterId, value: options }];
        });
    };

    const handleFilterClick = async () => {
        const sessionExpiryFilter = columnFilters.find(
            (filter) => filter.id === 'session_expiry_days'
        );
        const sessionExpiryDays = sessionExpiryFilter?.value.map((value) => {
            const numberMatch = value.label.match(/\d+/);
            return numberMatch ? parseInt(numberMatch[0]) : 0;
        });

        const statusFilter = columnFilters.find((filter) => filter.id === 'statuses');
        // If status filter is selected in UI, use those values
        // Otherwise, use all available statuses from API
        const statusesToApply =
            statusFilter?.value.map((option) => option.label) ||
            instituteDetails?.student_statuses ||
            [];

        const pksids =
            columnFilters
                .find((filter) => filter.id === 'batch')
                ?.value.map((option) => option.id) || allPackageSessionIds;

        setAppliedFilters((prev) => ({
            ...prev,
            name: searchFilter,
            package_session_ids: pksids,
            gender:
                columnFilters
                    .find((filter) => filter.id === 'gender')
                    ?.value.map((option) => option.label) || [],
            statuses: statusesToApply,
            session_expiry_days: sessionExpiryDays || [],
        }));
    };

    const handleClearFilters = async () => {
        setClearFilters(true);
        setColumnFilters([]);
        setSearchFilter('');
        setSearchInput('');

        const pksids = (instituteDetails?.batches_for_sessions || [])
            .filter((batch) => batch.session.id === currentSession.id)
            .map((batch) => batch.id);

        setAppliedFilters((prev) => ({
            ...prev,
            name: '',
            package_session_ids: pksids,
            gender: [],
            // When clearing filters, use all API-provided statuses
            statuses: instituteDetails?.student_statuses || [],
            session_expiry_days: [],
        }));
    };

    const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(event.target.value);
    };

    const handleSearchEnter = async () => {
        setSearchFilter(searchInput);
        setAppliedFilters((prev) => ({
            ...prev,
            name: searchInput,
        }));
    };

    const handleClearSearch = async () => {
        setSearchInput('');
        setSearchFilter('');
        setAppliedFilters((prev) => ({
            ...prev,
            name: '',
        }));
    };

    const getActiveFiltersState = useCallback(() => {
        const batchFilter = columnFilters.find((filter) => filter.id === 'batch');
        const statusFilter = columnFilters.find((filter) => filter.id === 'statuses');
        const sessionExpiryFilter = columnFilters.find(
            (filter) => filter.id === 'session_expiry_days'
        );

        const hasBatch = Boolean(batchFilter?.value && batchFilter.value.length > 0);
        const hasName = Boolean(appliedFilters.name?.trim());
        const hasGender = Array.isArray(appliedFilters.gender) && appliedFilters.gender.length > 0;
        // Only consider status filter if explicitly selected in UI
        const hasStatus = Boolean(statusFilter?.value && statusFilter.value.length > 0);
        const hasSessionExpiry = Boolean(
            sessionExpiryFilter?.value && sessionExpiryFilter.value.length > 0
        );

        return Boolean(hasName || hasGender || hasStatus || hasBatch || hasSessionExpiry);
    }, [columnFilters, appliedFilters]);

    return {
        columnFilters,
        appliedFilters,
        clearFilters,
        searchInput,
        searchFilter,
        currentSession,
        sessionList,
        getActiveFiltersState,
        handleFilterChange,
        handleFilterClick,
        handleClearFilters,
        handleSearchInputChange,
        handleSearchEnter,
        handleClearSearch,
        setAppliedFilters,
        handleSessionChange,
        setColumnFilters,
    };
};
