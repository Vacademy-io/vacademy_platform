/* eslint-disable @typescript-eslint/no-unused-vars */
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MyButton } from '@/components/design-system/button';
import { SessionStatus, sessionStatusLabels } from '../-constants/enums';
import LiveSessionCard from './live-session-card';
import { useNavigate } from '@tanstack/react-router';
import { useSessionSearch } from '../-hooks/useLiveSessions';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { SessionSearchRequest } from '../-services/utils';
import PreviousSessionCard from './previous-session-card';
import DraftSessionCard from './draft-session-card';
import { useSessionDetailsStore } from '../-store/useSessionDetailsStore';
import { useLiveSessionListStateStore } from '../-store/useLiveSessionListStateStore';
import { useLiveSessionStore } from '../schedule/-store/sessionIdstore';
import { Calendar as CalendarIcon } from 'lucide-react';
import { CaretDown, VideoCameraSlash, Clock, FunnelSimple, X } from '@phosphor-icons/react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { useQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { useFilterDataForAssesment } from '@/routes/assessment/assessment-list/-utils.ts/useFiltersData';
import { MyPagination } from '@/components/design-system/pagination';
import { RecurringType, AccessType, StreamingPlatform } from '../-constants/enums';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology, getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { type SelectOption } from '@/components/design-system/SelectChips';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

const AllBatchesOption: SelectOption = {
    label: 'All Batches',
    value: 'all',
};

export default function SessionListPage() {
    const { setNavHeading } = useNavHeadingStore();
    const { clearSessionDetails } = useSessionDetailsStore();
    const { clearSessionId } = useLiveSessionStore();
    const navigate = useNavigate();

    // Auth institute id
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = (tokenData && Object.keys(tokenData.authorities)[0]) || '';

    // Tab state — initial value comes from the in-memory list-state store so
    // pressing browser back from a class detail returns the admin to the same
    // tab they left from. A hard refresh resets the store and lands on Live.
    const [selectedTab, setSelectedTab] = useState<SessionStatus>(
        () => useLiveSessionListStateStore.getState().selectedTab
    );

    // Filter state
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [meetingTypeFilter, setMeetingTypeFilter] = useState<string>('');
    const [subjectFilter, setSubjectFilter] = useState<string[]>([]);
    const [accessFilter, setAccessFilter] = useState<string>('');
    const [streamingServiceFilter, setStreamingServiceFilter] = useState<string>('');
    const [startTimeOfDay, setStartTimeOfDay] = useState<string>('');
    const [endTimeOfDay, setEndTimeOfDay] = useState<string>('');
    const [datePopoverOpen, setDatePopoverOpen] = useState(false);

    const { data: instituteDetails } = useQuery(useInstituteQuery());
    const { SubjectFilterData } = useFilterDataForAssesment(instituteDetails!);
    const { instituteDetails: storeInstituteDetails } = useInstituteDetailsStore();

    // Build batch options from institute details
    const batchOptions = useMemo(() => {
        const batches =
            storeInstituteDetails?.batches_for_sessions?.map((batch) => ({
                label: batch.level.id === 'DEFAULT'
                    ? `${batch.package_dto.package_name.replace(/^default\s+/i, '')}, ${batch.session.session_name}`.trim()
                    : `${batch.level.level_name.replace(/^default\s+/i, '')} ${batch.package_dto.package_name.replace(/^default\s+/i, '')}, ${batch.session.session_name}`.trim(),
                value: batch.id, // This is the package_session_id
            })) || [];
        return [AllBatchesOption, ...batches];
    }, [storeInstituteDetails?.batches_for_sessions]);

    const [selectedBatches, setSelectedBatches] = useState<SelectOption[]>([AllBatchesOption]);
    const [batchSearch, setBatchSearch] = useState<string>('');

    // Controlled state for the Filters popover. Selections inside the popover
    // are buffered into `filterDraft` so they don't immediately re-fetch the
    // list — the user reviews their selections and clicks Apply to commit.
    const [filtersOpen, setFiltersOpen] = useState(false);
    interface FilterDraft {
        startTimeOfDay: string;
        endTimeOfDay: string;
        meetingTypeFilter: string;
        subjectFilter: string[];
        accessFilter: string;
        streamingServiceFilter: string;
        selectedBatches: SelectOption[];
    }
    const buildDraftFromCommitted = (): FilterDraft => ({
        startTimeOfDay,
        endTimeOfDay,
        meetingTypeFilter,
        subjectFilter: Array.isArray(subjectFilter) ? subjectFilter : [],
        accessFilter,
        streamingServiceFilter,
        selectedBatches,
    });
    const [filterDraft, setFilterDraft] = useState<FilterDraft>(buildDraftFromCommitted);

    // Seed the draft + flip the popover open in a single event handler so
    // React batches the two state updates into one render. Doing the seed in a
    // useEffect after `filtersOpen` flipped caused a visible flicker: the
    // popover would render once with the stale draft from the previous session
    // and then re-render with the fresh values.
    const handleFiltersOpenChange = (next: boolean) => {
        if (next) {
            setFilterDraft({
                startTimeOfDay,
                endTimeOfDay,
                meetingTypeFilter,
                subjectFilter: Array.isArray(subjectFilter) ? subjectFilter : [],
                accessFilter,
                streamingServiceFilter,
                selectedBatches,
            });
        }
        setFiltersOpen(next);
    };

    const applyFilters = () => {
        setStartTimeOfDay(filterDraft.startTimeOfDay);
        setEndTimeOfDay(filterDraft.endTimeOfDay);
        setMeetingTypeFilter(filterDraft.meetingTypeFilter);
        setSubjectFilter(filterDraft.subjectFilter);
        setAccessFilter(filterDraft.accessFilter);
        setStreamingServiceFilter(filterDraft.streamingServiceFilter);
        setSelectedBatches(
            filterDraft.selectedBatches.length > 0
                ? filterDraft.selectedBatches
                : [AllBatchesOption]
        );
        setCurrentPage(0);
        setFiltersOpen(false);
    };

    const resetDraft = () => {
        setFilterDraft({
            startTimeOfDay: '',
            endTimeOfDay: '',
            meetingTypeFilter: '',
            subjectFilter: [],
            accessFilter: '',
            streamingServiceFilter: '',
            selectedBatches: [AllBatchesOption],
        });
    };

    const draftFilterCount =
        (filterDraft.startTimeOfDay || filterDraft.endTimeOfDay ? 1 : 0) +
        (filterDraft.meetingTypeFilter ? 1 : 0) +
        (filterDraft.subjectFilter.length > 0 ? 1 : 0) +
        (filterDraft.accessFilter ? 1 : 0) +
        (filterDraft.streamingServiceFilter ? 1 : 0) +
        (filterDraft.selectedBatches.filter((b) => b.value !== 'all').length > 0 ? 1 : 0);

    // Pagination state - server-side
    const ITEMS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(
        () => useLiveSessionListStateStore.getState().currentPage
    );

    // Sync tab + page back to the in-memory store on every change so a back
    // navigation from the detail page can restore the same view.
    useEffect(() => {
        useLiveSessionListStateStore
            .getState()
            .setListState({ selectedTab, currentPage });
    }, [selectedTab, currentPage]);

    // Build search request based on current filters and tab
    const searchRequest: SessionSearchRequest = useMemo(() => {
        const baseRequest: SessionSearchRequest = {
            institute_id: INSTITUTE_ID,
            page: currentPage,
            size: ITEMS_PER_PAGE,
            sort_by: 'meetingDate',
            sort_direction: 'ASC',
        };

        // Get current date in user's local timezone
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: userTimezone }));
        const todayFormatted = format(nowLocal, 'yyyy-MM-dd');

        // Dynamic date limits
        const farFuture = new Date(nowLocal);
        farFuture.setFullYear(farFuture.getFullYear() + 50);
        const farFutureFormatted = format(farFuture, 'yyyy-MM-dd');

        const farPast = new Date(nowLocal);
        farPast.setFullYear(farPast.getFullYear() - 50);
        const farPastFormatted = format(farPast, 'yyyy-MM-dd');

        // Configure payload based on Tab (Strict Rules)
        switch (selectedTab) {
            case SessionStatus.UPCOMING:
                baseRequest.statuses = ['LIVE'];
                baseRequest.time_status = 'UPCOMING';
                baseRequest.sort_by = 'meetingDate';
                baseRequest.sort_direction = 'ASC';
                // CRITICAL: Override default 30-day limit
                baseRequest.start_date = startDate ? format(startDate, 'yyyy-MM-dd') : todayFormatted;
                baseRequest.end_date = endDate ? format(endDate, 'yyyy-MM-dd') : farFutureFormatted;
                break;

            case SessionStatus.PAST:
                baseRequest.statuses = ['LIVE'];
                baseRequest.time_status = 'PAST';
                baseRequest.sort_by = 'meetingDate';
                baseRequest.sort_direction = 'DESC';
                // CRITICAL: Override default "From Today" limit
                baseRequest.start_date = startDate ? format(startDate, 'yyyy-MM-dd') : farPastFormatted;
                baseRequest.end_date = endDate ? format(endDate, 'yyyy-MM-dd') : todayFormatted;
                break;

            case SessionStatus.DRAFTS:
                baseRequest.statuses = ['DRAFT'];
                baseRequest.time_status = null;
                baseRequest.sort_by = 'updatedAt';
                baseRequest.sort_direction = 'DESC';
                // CRITICAL: Show all drafts history
                baseRequest.start_date = startDate ? format(startDate, 'yyyy-MM-dd') : farPastFormatted;
                baseRequest.end_date = endDate ? format(endDate, 'yyyy-MM-dd') : farFutureFormatted;
                break;

            case SessionStatus.LIVE:
                baseRequest.statuses = ['LIVE'];
                // Intentionally do NOT default start_date / end_date here. When both are
                // omitted and statuses=['LIVE'], the backend applies a timezone-aware
                // "currently in progress" filter (meeting_date = today AND
                // start_time <= now <= last_entry_time). Sending an explicit date range
                // pushes the backend out of that smart-default branch and into a plain
                // date filter, which returns every scheduled session for the day
                // regardless of whether it's in progress — breaking pagination for the
                // Live tab. See LiveSessionRepositoryCustomImpl.searchSessions.
                if (startDate) {
                    baseRequest.start_date = format(startDate, 'yyyy-MM-dd');
                }
                if (endDate) {
                    baseRequest.end_date = format(endDate, 'yyyy-MM-dd');
                }
                break;
        }

        // Apply Common Filters.
        // Backend has no dedicated `subject_names` field on SessionSearchRequest,
        // so selected subjects are appended into `search_query` (same approach
        // the legacy single-subject filter used). With multiple subjects the
        // backend's substring match may narrow results, but the UI now matches
        // the multi-select pattern used for batches.
        // Normalize defensively: Vite HMR can preserve React state across a
        // type change, so an older string value may still be in memory until a
        // hard refresh. Treat any non-array value as empty.
        const subjectList = Array.isArray(subjectFilter) ? subjectFilter : [];
        const subjectTerms = subjectList.filter((s) => s && s !== 'DEFAULT');
        const subjectQuery = subjectTerms.join(' ');
        if (searchQuery) {
            baseRequest.search_query = subjectQuery
                ? `${searchQuery} ${subjectQuery}`
                : searchQuery;
        } else if (subjectQuery) {
            baseRequest.search_query = subjectQuery;
        }

        if (startTimeOfDay) {
            baseRequest.start_time_of_day = startTimeOfDay;
        }
        if (endTimeOfDay) {
            baseRequest.end_time_of_day = endTimeOfDay;
        }

        // Apply recurrence type filter
        if (meetingTypeFilter) {
            if (meetingTypeFilter === 'custom') {
                baseRequest.recurrence_types = ['weekly'];
            } else {
                baseRequest.recurrence_types = [meetingTypeFilter];
            }
        }

        // Apply access level filter
        if (accessFilter) {
            baseRequest.access_levels = [accessFilter];
        }

        // Apply streaming service filter.
        // Values must match `StreamingPlatform` enum strings (see
        // live-session/-constants/enums.ts) exactly — the backend query at
        // LiveSessionRepositoryCustomImpl `s.session_streaming_service_type IN
        // :streamingServiceTypes` is case-sensitive and the stored values are
        // lowercase, so we send the raw enum string without altering case.
        if (streamingServiceFilter) {
            baseRequest.streaming_service_types = [streamingServiceFilter];
        }

        // Apply batch filter
        if (selectedBatches.length > 0 && !selectedBatches.some((b) => b.value === 'all')) {
            baseRequest.batch_ids = selectedBatches.map((b) => b.value);
        }

        return baseRequest;
    }, [
        INSTITUTE_ID,
        currentPage,
        selectedTab,
        searchQuery,
        startDate,
        endDate,
        startTimeOfDay,
        endTimeOfDay,
        meetingTypeFilter,
        subjectFilter,
        accessFilter,
        streamingServiceFilter,
        selectedBatches,
    ]);

    // Fetch sessions using the new search API
    const { data: searchResponse, isLoading, error } = useSessionSearch(searchRequest);

    const handleTabChange = (value: string) => {
        setSelectedTab(value as SessionStatus);
        setCurrentPage(0); // Reset to first page when changing tabs
    };

    const handlePageChange = (pageIndex: number) => {
        setCurrentPage(pageIndex);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setCurrentPage(0); // Reset to first page on search
    };

    const clearFilters = () => {
        setSearchQuery('');
        setStartDate(undefined);
        setEndDate(undefined);
        setMeetingTypeFilter('');
        setSubjectFilter([]);
        setAccessFilter('');
        setStreamingServiceFilter('');
        setStartTimeOfDay('');
        setEndTimeOfDay('');
        setSelectedBatches([AllBatchesOption]);
        setBatchSearch('');
        setDatePopoverOpen(false);
        setCurrentPage(0);
    };

    // Human-readable label for the active platform value (used in the chip strip).
    const platformLabelFor = (value: string): string => {
        const map: Record<string, string> = {
            zoom: 'Zoom',
            'google meet': 'Google Meet',
            youtube: 'YouTube',
            bbb: 'Vacademy Meet',
            zoho: 'Zoho',
            other: 'Other',
        };
        return map[value] ?? value;
    };

    // Filter bar — rendered inline (called as a function, not used as a
    // JSX component) so it shares SessionListPage's render tree directly.
    // Using <FilterBar /> made React treat each render's arrow-function as a
    // new component identity and unmount/remount the popover on every keystroke
    // or pill click, which made the Filters popover flicker shut and reopen.
    const renderFilterBar = () => {
        // Active chips for filters that live in the inline row (search, date).
        const inlineChips: Array<{ key: string; label: string; value: string; onClear: () => void }> = [];
        if (searchQuery) {
            inlineChips.push({
                key: 'search',
                label: 'Search',
                value: `"${searchQuery}"`,
                onClear: () => setSearchQuery(''),
            });
        }
        if (startDate || endDate) {
            const left = startDate ? format(startDate, 'dd MMM') : '…';
            const right = endDate ? format(endDate, 'dd MMM') : '…';
            inlineChips.push({
                key: 'date',
                label: 'Date',
                value: `${left} – ${right}`,
                onClear: () => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                },
            });
        }

        // Active chips for filters living inside the Filters popover.
        const attributeChips: Array<{ key: string; label: string; value: string; onClear: () => void }> = [];
        if (startTimeOfDay || endTimeOfDay) {
            attributeChips.push({
                key: 'time',
                label: 'Time',
                value: `${startTimeOfDay || '00:00'} – ${endTimeOfDay || '23:59'}`,
                onClear: () => {
                    setStartTimeOfDay('');
                    setEndTimeOfDay('');
                },
            });
        }
        if (meetingTypeFilter) {
            const v = meetingTypeFilter === RecurringType.ONCE
                ? 'Once'
                : meetingTypeFilter === RecurringType.WEEKLY
                    ? 'Weekly'
                    : meetingTypeFilter === 'custom' ? 'Custom' : meetingTypeFilter;
            attributeChips.push({
                key: 'meeting',
                label: 'Meeting type',
                value: v,
                onClear: () => setMeetingTypeFilter(''),
            });
        }
        const subjectChipList = Array.isArray(subjectFilter) ? subjectFilter : [];
        if (subjectChipList.length > 0) {
            attributeChips.push({
                key: 'subject',
                label: 'Subject',
                value:
                    subjectChipList.length === 1
                        ? subjectChipList[0]!
                        : `${subjectChipList.length} selected`,
                onClear: () => setSubjectFilter([]),
            });
        }
        if (accessFilter) {
            attributeChips.push({
                key: 'access',
                label: 'Access',
                value: accessFilter.charAt(0).toUpperCase() + accessFilter.slice(1),
                onClear: () => setAccessFilter(''),
            });
        }
        if (streamingServiceFilter) {
            attributeChips.push({
                key: 'platform',
                label: 'Platform',
                value: platformLabelFor(streamingServiceFilter),
                onClear: () => setStreamingServiceFilter(''),
            });
        }
        const nonAllBatches = selectedBatches.filter((b) => b.value !== 'all');
        if (nonAllBatches.length > 0) {
            attributeChips.push({
                key: 'batches',
                label: getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch),
                value: nonAllBatches.length === 1 ? nonAllBatches[0]!.label : `${nonAllBatches.length} selected`,
                onClear: () => setSelectedBatches([AllBatchesOption]),
            });
        }

        const allChips = [...inlineChips, ...attributeChips];
        const hasAnyFilter = allChips.length > 0;
        const attributeFilterCount = attributeChips.length;

        // Reusable styles for popover-internal option pills.
        const pillBase =
            'rounded-full border px-3 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300';
        const pillOn = 'border-primary-500 bg-primary-50 text-primary-600';
        const pillOff = 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50';

        return (
        <div className="mb-4 rounded-lg border bg-white p-3 sm:mb-6 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Search */}
                <div className="relative min-w-0 flex-1 basis-full sm:basis-auto sm:min-w-[260px]">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-neutral-400"
                        >
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.3-4.3"></path>
                        </svg>
                    </div>
                    <input
                        autoFocus
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        placeholder="Search sessions..."
                        className="h-9 w-full rounded-md border border-neutral-300 bg-white py-2 pl-10 pr-3 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                </div>

                {/* Date range */}
                <div className="w-[calc(50%-4px)] sm:w-[220px]">
                    <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                        <PopoverTrigger asChild>
                            <button
                                className={`flex h-9 w-full items-center justify-between rounded-md border px-3 ${startDate || endDate ? 'border-primary-500' : 'border-neutral-300'} focus:border-primary-500 focus:ring-1 focus:ring-primary-500`}
                            >
                                {startDate && endDate
                                    ? `${format(startDate, 'dd/MM/yy')} - ${format(endDate, 'dd/MM/yy')}`
                                    : startDate
                                        ? `From ${format(startDate, 'dd/MM/yy')}`
                                        : endDate
                                            ? `To ${format(endDate, 'dd/MM/yy')}`
                                            : 'Select date range'}
                                <CalendarIcon className="text-neutral-500" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[280px] p-0">
                            {(() => {
                                // Forward-looking presets make sense for Upcoming /
                                // Live tabs; everything else (Past, Drafts) is
                                // historical. Same numbers, opposite direction.
                                const isForward =
                                    selectedTab === SessionStatus.UPCOMING ||
                                    selectedTab === SessionStatus.LIVE;
                                const directionLabel = isForward ? 'Next' : 'Past';
                                const applyDays = (days: number) => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    if (days === 1) {
                                        setStartDate(today);
                                        setEndDate(today);
                                    } else if (isForward) {
                                        const end = new Date(today);
                                        end.setDate(end.getDate() + (days - 1));
                                        setStartDate(today);
                                        setEndDate(end);
                                    } else {
                                        const start = new Date(today);
                                        start.setDate(start.getDate() - (days - 1));
                                        setStartDate(start);
                                        setEndDate(today);
                                    }
                                    setDatePopoverOpen(false);
                                };
                                const presets: Array<{ label: string; days: number }> = [
                                    { label: 'Today', days: 1 },
                                    { label: `${directionLabel} 3 days`, days: 3 },
                                    { label: `${directionLabel} 7 days`, days: 7 },
                                    { label: `${directionLabel} 10 days`, days: 10 },
                                    { label: `${directionLabel} 15 days`, days: 15 },
                                ];
                                // Highlight a preset only if the current range
                                // exactly matches its computed window.
                                const presetMatchesDays = (days: number): boolean => {
                                    if (!startDate || !endDate) return false;
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    let expectedStart: Date;
                                    let expectedEnd: Date;
                                    if (days === 1) {
                                        expectedStart = today;
                                        expectedEnd = today;
                                    } else if (isForward) {
                                        expectedStart = today;
                                        expectedEnd = new Date(today);
                                        expectedEnd.setDate(today.getDate() + (days - 1));
                                    } else {
                                        expectedEnd = today;
                                        expectedStart = new Date(today);
                                        expectedStart.setDate(today.getDate() - (days - 1));
                                    }
                                    const sameDay = (a: Date, b: Date) =>
                                        format(a, 'yyyy-MM-dd') === format(b, 'yyyy-MM-dd');
                                    return (
                                        sameDay(startDate, expectedStart) &&
                                        sameDay(endDate, expectedEnd)
                                    );
                                };
                                return (
                                    <>
                                        <div className="border-b border-neutral-100 px-4 py-3">
                                            <h4 className="text-xs font-medium text-neutral-700">
                                                Quick select
                                            </h4>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {presets.map((p) => {
                                                    const active = presetMatchesDays(p.days);
                                                    return (
                                                        <button
                                                            key={p.label}
                                                            type="button"
                                                            onClick={() => applyDays(p.days)}
                                                            className={`rounded-full border px-3 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300 ${
                                                                active
                                                                    ? 'border-primary-500 bg-primary-50 text-primary-600'
                                                                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                                                            }`}
                                                        >
                                                            {p.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="px-4 py-3">
                                            <h4 className="text-xs font-medium text-neutral-700">
                                                Custom range
                                            </h4>
                                            <div className="mt-2 flex flex-col gap-2">
                                                <label className="flex flex-col gap-1">
                                                    <span className="text-[11px] text-neutral-500">
                                                        Start date
                                                    </span>
                                                    <input
                                                        type="date"
                                                        value={
                                                            startDate
                                                                ? format(startDate, 'yyyy-MM-dd')
                                                                : ''
                                                        }
                                                        onChange={(e) =>
                                                            setStartDate(
                                                                e.target.value
                                                                    ? new Date(e.target.value)
                                                                    : undefined
                                                            )
                                                        }
                                                        className="h-8 rounded-md border border-neutral-300 px-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                    />
                                                </label>
                                                <label className="flex flex-col gap-1">
                                                    <span className="text-[11px] text-neutral-500">
                                                        End date
                                                    </span>
                                                    <input
                                                        type="date"
                                                        value={
                                                            endDate
                                                                ? format(endDate, 'yyyy-MM-dd')
                                                                : ''
                                                        }
                                                        onChange={(e) =>
                                                            setEndDate(
                                                                e.target.value
                                                                    ? new Date(e.target.value)
                                                                    : undefined
                                                            )
                                                        }
                                                        className="h-8 rounded-md border border-neutral-300 px-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setStartDate(undefined);
                                                    setEndDate(undefined);
                                                }}
                                                disabled={!startDate && !endDate}
                                                className="text-xs text-neutral-500 hover:text-neutral-800 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
                                            >
                                                Clear
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDatePopoverOpen(false)}
                                                className="rounded-md bg-primary-500 px-3 py-1 text-xs text-white hover:bg-primary-600"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Filters popover — Time of Day, Meeting Type, Subject,
                    Access Type, Platform, Batches collapsed into one place.
                    Selections are buffered into a local draft and committed
                    only when the user clicks Apply. */}
                <Popover open={filtersOpen} onOpenChange={handleFiltersOpenChange}>
                    <PopoverTrigger asChild>
                        <button
                            className={`flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                                attributeFilterCount > 0
                                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                                    : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                            }`}
                        >
                            <FunnelSimple size={16} weight="bold" />
                            <span>Filters</span>
                            {attributeFilterCount > 0 && (
                                <span className="rounded-full bg-primary-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                                    {attributeFilterCount}
                                </span>
                            )}
                            <CaretDown size={14} className="text-neutral-500" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        className="w-[360px] max-w-[calc(100vw-2rem)] p-0"
                    >
                        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                            <h3 className="text-sm font-semibold text-neutral-800">
                                Filters
                            </h3>
                            <button
                                type="button"
                                onClick={resetDraft}
                                disabled={draftFilterCount === 0}
                                className="text-xs font-medium text-red-600 transition-opacity hover:text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline"
                            >
                                Reset
                            </button>
                        </div>
                        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto p-4">
                            {/* Time of Day */}
                            <section>
                                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-700">
                                    <Clock size={14} className="text-neutral-500" />
                                    Time of Day
                                </h4>
                                <div className="flex gap-2">
                                    <input
                                        type="time"
                                        value={filterDraft.startTimeOfDay}
                                        onChange={(e) =>
                                            setFilterDraft((d) => ({
                                                ...d,
                                                startTimeOfDay: e.target.value,
                                            }))
                                        }
                                        className="h-8 flex-1 rounded-md border border-neutral-300 px-2 text-sm"
                                        aria-label="Start time"
                                    />
                                    <input
                                        type="time"
                                        value={filterDraft.endTimeOfDay}
                                        onChange={(e) =>
                                            setFilterDraft((d) => ({
                                                ...d,
                                                endTimeOfDay: e.target.value,
                                            }))
                                        }
                                        className="h-8 flex-1 rounded-md border border-neutral-300 px-2 text-sm"
                                        aria-label="End time"
                                    />
                                </div>
                            </section>

                            {/* Meeting Type */}
                            <section>
                                <h4 className="mb-2 text-xs font-medium text-neutral-700">
                                    Meeting Type
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { label: 'All', value: '' },
                                        { label: 'Once', value: RecurringType.ONCE },
                                        { label: 'Weekly', value: RecurringType.WEEKLY },
                                        { label: 'Custom', value: 'custom' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.label}
                                            type="button"
                                            onClick={() =>
                                                setFilterDraft((d) => ({
                                                    ...d,
                                                    meetingTypeFilter: opt.value,
                                                }))
                                            }
                                            className={`${pillBase} ${
                                                filterDraft.meetingTypeFilter === opt.value
                                                    ? pillOn
                                                    : pillOff
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Subject — multi-select, mirrors the batches pattern */}
                            <section>
                                <h4 className="mb-2 flex items-center justify-between text-xs font-medium text-neutral-700">
                                    <span>Subject</span>
                                    {filterDraft.subjectFilter.length > 0 && (
                                        <span className="text-[10px] font-normal text-neutral-500">
                                            {filterDraft.subjectFilter.length} selected
                                        </span>
                                    )}
                                </h4>
                                <div className="flex max-h-[140px] flex-wrap gap-1.5 overflow-y-auto rounded-md border border-neutral-100 bg-neutral-50/40 p-2">
                                    {[
                                        { id: 'all', name: 'All' },
                                        ...SubjectFilterData.sort((a, b) =>
                                            a.name.localeCompare(b.name)
                                        ),
                                    ].map((opt) => {
                                        const isAll = opt.name === 'All';
                                        const isActive = isAll
                                            ? filterDraft.subjectFilter.length === 0
                                            : filterDraft.subjectFilter.includes(opt.name);
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => {
                                                    if (isAll) {
                                                        setFilterDraft((d) => ({
                                                            ...d,
                                                            subjectFilter: [],
                                                        }));
                                                        return;
                                                    }
                                                    setFilterDraft((d) => ({
                                                        ...d,
                                                        subjectFilter: d.subjectFilter.includes(
                                                            opt.name
                                                        )
                                                            ? d.subjectFilter.filter(
                                                                  (s) => s !== opt.name
                                                              )
                                                            : [...d.subjectFilter, opt.name],
                                                    }));
                                                }}
                                                className={`${pillBase} ${isActive ? pillOn : pillOff}`}
                                            >
                                                {opt.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Access Type */}
                            <section>
                                <h4 className="mb-2 text-xs font-medium text-neutral-700">
                                    Access Type
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { label: 'All', value: '' },
                                        ...Object.values(AccessType).map((a) => ({
                                            label: a.charAt(0).toUpperCase() + a.slice(1),
                                            value: a,
                                        })),
                                    ].map((opt) => (
                                        <button
                                            key={opt.label}
                                            type="button"
                                            onClick={() =>
                                                setFilterDraft((d) => ({
                                                    ...d,
                                                    accessFilter: opt.value,
                                                }))
                                            }
                                            className={`${pillBase} ${
                                                filterDraft.accessFilter === opt.value
                                                    ? pillOn
                                                    : pillOff
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Platform */}
                            <section>
                                <h4 className="mb-2 text-xs font-medium text-neutral-700">
                                    Platform
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { label: 'All', value: '' },
                                        { label: 'Zoom', value: 'zoom' },
                                        { label: 'Google Meet', value: 'google meet' },
                                        { label: 'YouTube', value: 'youtube' },
                                        { label: 'Vacademy Meet', value: 'bbb' },
                                        { label: 'Other', value: 'other' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.label}
                                            type="button"
                                            onClick={() =>
                                                setFilterDraft((d) => ({
                                                    ...d,
                                                    streamingServiceFilter: opt.value,
                                                }))
                                            }
                                            className={`${pillBase} ${
                                                filterDraft.streamingServiceFilter === opt.value
                                                    ? pillOn
                                                    : pillOff
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Batches — inline searchable list. SelectChips
                                opens its own nested popover which collides with
                                this one, so we render checkboxes directly. */}
                            <section>
                                <h4 className="mb-2 flex items-center justify-between text-xs font-medium text-neutral-700">
                                    <span>
                                        {getTerminologyPlural(
                                            ContentTerms.Batch,
                                            SystemTerms.Batch
                                        )}
                                    </span>
                                    {filterDraft.selectedBatches.filter((b) => b.value !== 'all')
                                        .length > 0 && (
                                        <span className="font-normal text-primary-600">
                                            {
                                                filterDraft.selectedBatches.filter(
                                                    (b) => b.value !== 'all'
                                                ).length
                                            }{' '}
                                            selected
                                        </span>
                                    )}
                                </h4>
                                <div className="rounded-md border border-neutral-200">
                                    <div className="border-b border-neutral-100 p-1.5">
                                        <input
                                            type="text"
                                            value={batchSearch}
                                            onChange={(e) => setBatchSearch(e.target.value)}
                                            placeholder={`Search ${getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch).toLowerCase()}…`}
                                            className="h-7 w-full rounded border-none bg-transparent px-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
                                        />
                                    </div>
                                    <div className="max-h-[160px] overflow-y-auto py-1">
                                        {(() => {
                                            const q = batchSearch.trim().toLowerCase();
                                            const matched = batchOptions.filter((opt) =>
                                                q ? opt.label.toLowerCase().includes(q) : true
                                            );
                                            if (matched.length === 0) {
                                                return (
                                                    <div className="px-3 py-4 text-center text-xs text-neutral-400">
                                                        No matches
                                                    </div>
                                                );
                                            }
                                            const isAll = filterDraft.selectedBatches.some(
                                                (b) => b.value === 'all'
                                            );
                                            return matched.map((opt) => {
                                                const isCheckedAll = opt.value === 'all' && isAll;
                                                const isCheckedItem =
                                                    opt.value !== 'all' &&
                                                    filterDraft.selectedBatches.some(
                                                        (b) => b.value === opt.value
                                                    );
                                                const isChecked = isCheckedAll || isCheckedItem;
                                                return (
                                                    <label
                                                        key={opt.value}
                                                        className="flex cursor-pointer items-start gap-2 px-3 py-1.5 hover:bg-neutral-50"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                if (opt.value === 'all') {
                                                                    setFilterDraft((d) => ({
                                                                        ...d,
                                                                        selectedBatches: [
                                                                            AllBatchesOption,
                                                                        ],
                                                                    }));
                                                                    return;
                                                                }
                                                                setFilterDraft((d) => {
                                                                    const withoutAll =
                                                                        d.selectedBatches.filter(
                                                                            (b) =>
                                                                                b.value !== 'all'
                                                                        );
                                                                    const currentlyChecked =
                                                                        withoutAll.some(
                                                                            (b) =>
                                                                                b.value ===
                                                                                opt.value
                                                                        );
                                                                    const next = currentlyChecked
                                                                        ? withoutAll.filter(
                                                                              (b) =>
                                                                                  b.value !==
                                                                                  opt.value
                                                                          )
                                                                        : [...withoutAll, opt];
                                                                    return {
                                                                        ...d,
                                                                        selectedBatches:
                                                                            next.length === 0
                                                                                ? [
                                                                                      AllBatchesOption,
                                                                                  ]
                                                                                : next,
                                                                    };
                                                                });
                                                            }}
                                                            className="mt-0.5 size-3.5 shrink-0 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                                                        />
                                                        <span
                                                            className={`text-xs leading-snug ${
                                                                isChecked
                                                                    ? 'font-medium text-primary-700'
                                                                    : 'text-neutral-700'
                                                            }`}
                                                        >
                                                            {opt.label}
                                                        </span>
                                                    </label>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            </section>
                        </div>
                        {/* Footer — Cancel discards the draft, Apply commits it. */}
                        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/60 px-4 py-2.5">
                            <button
                                type="button"
                                onClick={() => setFiltersOpen(false)}
                                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={applyFilters}
                                className="rounded-md bg-primary-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600"
                            >
                                Apply
                            </button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Active filter chips */}
            {hasAnyFilter && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                    {allChips.map((chip) => (
                        <span
                            key={chip.key}
                            className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 py-1 pl-2.5 pr-1.5 text-xs text-primary-700"
                        >
                            <span className="font-medium">{chip.label}:</span>
                            <span className="max-w-[180px] truncate">{chip.value}</span>
                            <button
                                type="button"
                                onClick={chip.onClear}
                                className="flex size-4 items-center justify-center rounded-full text-primary-500 hover:bg-primary-100 hover:text-primary-700"
                                aria-label={`Clear ${chip.label}`}
                            >
                                <X size={10} weight="bold" />
                            </button>
                        </span>
                    ))}
                    <button
                        onClick={clearFilters}
                        className="ml-auto text-xs text-neutral-500 hover:text-neutral-800 hover:underline"
                    >
                        Clear all
                    </button>
                </div>
            )}
        </div>
        );
    };

    useEffect(() => {
        setNavHeading(getTerminologyPlural(ContentTerms.LiveSession, SystemTerms.LiveSession));
        clearSessionDetails();
        clearSessionId();
    }, [setNavHeading, clearSessionDetails, clearSessionId]);

    // Render sessions based on current tab
    const renderSessions = () => {
        if (isLoading) {
            return (
                <div className="flex h-[300px] items-center justify-center">
                    <div className="text-neutral-500">Loading sessions...</div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex h-[300px] items-center justify-center">
                    <div className="text-red-500">Error loading sessions: {error.message}</div>
                </div>
            );
        }

        const tabLabel =
            selectedTab === SessionStatus.LIVE
                ? 'Live'
                : selectedTab === SessionStatus.UPCOMING
                    ? 'Upcoming'
                    : selectedTab === SessionStatus.PAST
                        ? 'Past'
                        : 'Draft';

        const renderBigEmpty = () => (
            <div className="flex h-[300px] flex-col items-center justify-center gap-4 text-center">
                <VideoCameraSlash size={64} className="text-neutral-300" />
                <h2 className="text-2xl font-bold text-neutral-600">No {tabLabel} Sessions</h2>
                <p className="max-w-xs text-sm text-neutral-500">
                    {tabLabel === 'Draft'
                        ? 'No draft sessions found. Create a new session to get started.'
                        : 'Schedule your first live class to engage with learners in real time.'}
                </p>
            </div>
        );

        if (!searchResponse?.sessions || searchResponse.sessions.length === 0) {
            return renderBigEmpty();
        }



        // Use sessions directly from API response (filtering is server-side mostly, but client-side for LIVE tab specific logic)
        let filteredSessions = searchResponse.sessions;

        // FRONTEND FILTERING for LIVE, UPCOMING, PAST tabs to handle midnight crossover correctly
        if (
            selectedTab === SessionStatus.LIVE ||
            selectedTab === SessionStatus.UPCOMING ||
            selectedTab === SessionStatus.PAST
        ) {
            const now = new Date();
            const normalizeTime = (t: string) => {
                if (t.includes('T')) {
                    const afterT = t.split('T')[1] || t;
                    return afterT.replace(/[+-]\d{2}:\d{2}$|Z$/, '');
                }
                return t.replace(/[+-]\d{2}:\d{2}$|Z$/, '');
            };

            filteredSessions = searchResponse.sessions.filter((session) => {
                const sessionTimezone = session.timezone || 'Asia/Kolkata';

                const sessionStartString = `${session.meeting_date}T${normalizeTime(session.start_time)}`;
                const sessionEndString = `${session.meeting_date}T${normalizeTime(session.last_entry_time)}`;

                const startTime = fromZonedTime(sessionStartString, sessionTimezone);
                let endTime = fromZonedTime(sessionEndString, sessionTimezone);

                // Handle midnight crossover (e.g., 23:00 to 00:30)
                if (endTime < startTime) {
                    endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
                }

                if (selectedTab === SessionStatus.LIVE) {
                    return startTime <= now && now <= endTime;
                } else if (selectedTab === SessionStatus.UPCOMING) {
                    return now < startTime;
                } else if (selectedTab === SessionStatus.PAST) {
                    return now > endTime;
                }
                return true;
            });
        }

        // If the timezone filter removed every session on this page, show the big
        // empty state for the current tab instead of a confusing inline fallback.
        if (filteredSessions.length === 0) {
            return renderBigEmpty();
        }

        return (
            <div>
                <div className="space-y-4">
                    {filteredSessions.length > 0 ? (
                        filteredSessions.map((session) => {
                            // Convert API response to component props format
                            const sessionData = {
                                session_id: session.session_id,
                                schedule_id: session.schedule_id,
                                meeting_date: session.meeting_date,
                                start_time: session.start_time,
                                last_entry_time: session.last_entry_time,
                                recurrence_type: session.recurrence_type,
                                access_level: session.access_level,
                                title: session.title,
                                subject: session.subject || '',
                                meeting_link: session.meeting_link,
                                registration_form_link_for_public_sessions:
                                    session.registration_form_link_for_public_sessions || '',
                                timezone: session.timezone,
                                default_class_link: session.default_class_link,
                                defaultClassName: session.default_class_name,
                                learner_button_config: session.learner_button_config,
                                package_session_details: session.package_session_details,
                            };

                            if (selectedTab === SessionStatus.PAST) {
                                return (
                                    <PreviousSessionCard
                                        key={`${session.session_id}-${session.schedule_id}`}
                                        session={sessionData}
                                    />
                                );
                            } else if (selectedTab === SessionStatus.DRAFTS) {
                                const draftSession = {
                                    ...sessionData,
                                    waiting_room_time: session.waiting_room_time,
                                    thumbnail_file_id: session.thumbnail_file_id,
                                    background_score_file_id: session.background_score_file_id,
                                    session_streaming_service_type:
                                        session.session_streaming_service_type,
                                };
                                return (
                                    <DraftSessionCard key={session.session_id} session={draftSession} />
                                );
                            } else {
                                return (
                                    <LiveSessionCard
                                        key={`${session.session_id}-${session.schedule_id}`}
                                        session={sessionData}
                                    />
                                );
                            }
                        })
                    ) : (
                        <div className="flex h-[200px] items-center justify-center text-neutral-500">
                            No {tabLabel.toLowerCase()} sessions on this page.
                        </div>
                    )}
                </div>
                {searchResponse.pagination.total_pages > 1 && (
                    <div className="mt-6">
                        <MyPagination
                            currentPage={searchResponse.pagination.current_page}
                            totalPages={searchResponse.pagination.total_pages}
                            onPageChange={handlePageChange}
                        />
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            {renderFilterBar()}
            <Tabs value={selectedTab} onValueChange={handleTabChange}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <TabsList className="inline-flex h-auto justify-start gap-1 overflow-x-auto rounded-none border-b !bg-transparent p-0 sm:gap-4">
                        {Object.values(SessionStatus).map((status) => (
                            <TabsTrigger
                                key={status}
                                value={status}
                                className={`flex shrink-0 gap-1.5 rounded-none px-4 py-2 text-sm !shadow-none sm:px-12 ${selectedTab === status
                                    ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                    : 'border-none bg-transparent'
                                    }`}
                            >
                                {sessionStatusLabels[status]}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <MyButton
                        onClick={() => navigate({ to: '/study-library/live-session/schedule' })}
                        buttonType="primary"
                        className="w-full sm:w-auto"
                    >
                        Schedule
                    </MyButton>
                </div>

                <TabsContent value={SessionStatus.LIVE} className="space-y-4">
                    {renderSessions()}
                </TabsContent>
                <TabsContent value={SessionStatus.UPCOMING} className="space-y-4">
                    {renderSessions()}
                </TabsContent>
                <TabsContent value={SessionStatus.PAST} className="space-y-4">
                    {renderSessions()}
                </TabsContent>
                <TabsContent value={SessionStatus.DRAFTS} className="space-y-4">
                    {renderSessions()}
                </TabsContent>
            </Tabs>
        </>
    );
}
