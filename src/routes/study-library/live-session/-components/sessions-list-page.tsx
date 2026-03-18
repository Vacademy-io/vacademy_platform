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
import { useLiveSessionStore } from '../schedule/-store/sessionIdstore';
import { Calendar as CalendarIcon } from 'lucide-react';
import { CaretDown, VideoCameraSlash, Clock } from '@phosphor-icons/react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { useQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { useFilterDataForAssesment } from '@/routes/assessment/assessment-list/-utils.ts/useFiltersData';
import { MyPagination } from '@/components/design-system/pagination';
import { RecurringType, AccessType, StreamingPlatform } from '../-constants/enums';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import SelectChips, { SelectOption } from '@/components/design-system/SelectChips';
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

    // Tab state
    const [selectedTab, setSelectedTab] = useState<SessionStatus>(SessionStatus.LIVE);

    // Filter state
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [meetingTypeFilter, setMeetingTypeFilter] = useState<string>('');
    const [subjectFilter, setSubjectFilter] = useState<string>('');
    const [accessFilter, setAccessFilter] = useState<string>('');
    const [streamingServiceFilter, setStreamingServiceFilter] = useState<string>('');
    const [startTimeOfDay, setStartTimeOfDay] = useState<string>('');
    const [endTimeOfDay, setEndTimeOfDay] = useState<string>('');
    const [datePopoverOpen, setDatePopoverOpen] = useState(false);
    const [timePopoverOpen, setTimePopoverOpen] = useState(false);

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

    // Pagination state - server-side
    const ITEMS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(0);

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
                // baseRequest.time_status = 'LIVE'; // Removed as per requirement to fix filtering
                // Live Now uses default sorting or backend logic
                // Respect user date filters if provided, otherwise let backend handle "Current" logic
                baseRequest.start_date = startDate ? format(startDate, 'yyyy-MM-dd') : todayFormatted;
                baseRequest.end_date = endDate ? format(endDate, 'yyyy-MM-dd') : todayFormatted;
                break;
        }

        // Apply Common Filters
        if (searchQuery) {
            baseRequest.search_query = searchQuery;
            // Append subject filter search if present
            if (subjectFilter && subjectFilter !== 'DEFAULT') {
                baseRequest.search_query = `${searchQuery} ${subjectFilter}`;
            }
        } else if (subjectFilter && subjectFilter !== 'DEFAULT') {
            baseRequest.search_query = subjectFilter;
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

        // Apply streaming service filter
        if (streamingServiceFilter) {
            baseRequest.streaming_service_types = [streamingServiceFilter.toUpperCase()];
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
        setSubjectFilter('');
        setAccessFilter('');
        setStreamingServiceFilter('');
        setStartTimeOfDay('');
        setEndTimeOfDay('');
        setSelectedBatches([AllBatchesOption]);
        setDatePopoverOpen(false);
        setTimePopoverOpen(false);
        setCurrentPage(0);
    };

    const handleBatchChange = (batches: SelectOption[]) => {
        if (batches.length > 0) {
            setSelectedBatches(batches);
            setCurrentPage(0); // Reset to first page on filter change
        }
    };

    // Filter bar component
    const FilterBar = () => (
        <div className="mb-6 rounded-lg border bg-white p-4">
            <div className="flex flex-wrap gap-3">
                {/* Search */}
                <div className="relative min-w-[200px] flex-1">
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
                <div className="w-[220px]">
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
                        <PopoverContent align="start" className="w-auto p-3">
                            <div className="flex gap-3">
                                <Calendar
                                    mode="range"
                                    className="border-r pr-3"
                                    selected={{ from: startDate, to: endDate }}
                                    onSelect={(r) => {
                                        setStartDate(r?.from);
                                        setEndDate(r?.to);
                                        if (
                                            r?.from &&
                                            r?.to &&
                                            r.to.getTime() !== r.from.getTime()
                                        ) {
                                            setDatePopoverOpen(false);
                                        }
                                    }}
                                />
                                {/* Quick presets */}
                                <div className="flex flex-col gap-2 pt-1">
                                    <h4 className="mb-1 text-xs font-medium text-neutral-500">
                                        Quick Select
                                    </h4>
                                    {[
                                        { label: 'Today', days: 0 },
                                        { label: 'Past Week', days: 7 },
                                        { label: 'Past Month', days: 30 },
                                        { label: 'Next Week', days: -7, future: true },
                                        { label: 'Next Month', days: -30, future: true },
                                    ].map((preset) => (
                                        <button
                                            key={preset.label}
                                            onClick={() => {
                                                if (preset.future) {
                                                    const start = new Date();
                                                    const end = new Date();
                                                    end.setDate(
                                                        end.getDate() + Math.abs(preset.days)
                                                    );
                                                    setStartDate(start);
                                                    setEndDate(end);
                                                } else if (preset.days === 0) {
                                                    const today = new Date();
                                                    setStartDate(today);
                                                    setEndDate(today);
                                                } else {
                                                    const end = new Date();
                                                    const start = new Date();
                                                    start.setDate(start.getDate() - preset.days);
                                                    setStartDate(start);
                                                    setEndDate(end);
                                                }
                                                setDatePopoverOpen(false);
                                            }}
                                            className="w-full rounded-md border px-3 py-1.5 text-left text-xs hover:bg-neutral-50"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Time of day filter */}
                <div className="w-[180px]">
                    <Popover open={timePopoverOpen} onOpenChange={setTimePopoverOpen}>
                        <PopoverTrigger asChild>
                            <button
                                className={`flex h-9 w-full items-center justify-between rounded-md border px-3 ${startTimeOfDay || endTimeOfDay ? 'border-primary-500' : 'border-neutral-300'} focus:border-primary-500 focus:ring-1 focus:ring-primary-500`}
                            >
                                {startTimeOfDay || endTimeOfDay ? 'Time Set' : 'Time of Day'}
                                <Clock size={20} className="text-neutral-500" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-3">
                            <div className="flex flex-col gap-3">
                                <h4 className="text-xs font-medium text-neutral-500">Time Range</h4>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs text-neutral-600">Start Time</label>
                                    <input
                                        type="time"
                                        value={startTimeOfDay}
                                        onChange={(e) => setStartTimeOfDay(e.target.value)}
                                        className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs text-neutral-600">End Time</label>
                                    <input
                                        type="time"
                                        value={endTimeOfDay}
                                        onChange={(e) => setEndTimeOfDay(e.target.value)}
                                        className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                    />
                                </div>
                                <button
                                    onClick={() => setTimePopoverOpen(false)}
                                    className="rounded-md bg-primary-500 px-3 py-1.5 text-sm text-white hover:bg-primary-600"
                                >
                                    Apply
                                </button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Meeting Type */}
                <div className="w-[180px]">
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className={`flex h-9 w-full items-center justify-between rounded-md border px-3 ${meetingTypeFilter ? 'border-primary-500' : 'border-neutral-300'} focus:border-primary-500 focus:ring-1 focus:ring-primary-500`}
                            >
                                {meetingTypeFilter || 'Meeting Type'}
                                <CaretDown size={20} className="text-neutral-500" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-3">
                            <div className="flex flex-col gap-2">
                                <h4 className="mb-1 text-xs font-medium text-neutral-500">
                                    Meeting Type
                                </h4>
                                {[
                                    { label: 'All', value: '' },
                                    { label: 'Once', value: RecurringType.ONCE },
                                    { label: 'Weekly', value: RecurringType.WEEKLY },
                                    { label: 'Custom', value: 'custom' },
                                ].map((opt) => (
                                    <button
                                        key={opt.label}
                                        onClick={() => setMeetingTypeFilter(opt.value)}
                                        className={`w-full rounded-md border px-3 py-1.5 text-left text-sm ${meetingTypeFilter === opt.value ? 'text-primary-600 border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Subject */}
                <div className="w-[180px]">
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className={`flex h-9 w-full items-center justify-between rounded-md border px-3 ${subjectFilter ? 'border-primary-500' : 'border-neutral-300'} focus:border-primary-500 focus:ring-1 focus:ring-primary-500`}
                            >
                                {subjectFilter || 'Subject'}
                                <CaretDown size={20} className="text-neutral-500" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-3">
                            <div className="flex flex-col gap-2">
                                <h4 className="mb-1 text-xs font-medium text-neutral-500">
                                    Subject
                                </h4>
                                <div className="max-h-[140px] w-[200px] overflow-y-auto">
                                    {[
                                        { id: 'all', name: 'All' },
                                        ...SubjectFilterData.sort((a, b) =>
                                            a.name.localeCompare(b.name)
                                        ),
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() =>
                                                setSubjectFilter(opt.name === 'All' ? '' : opt.name)
                                            }
                                            className={`mb-2 w-full rounded-md border px-3 py-1.5 text-left text-sm ${subjectFilter === opt.name ? 'text-primary-600 border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                                        >
                                            {opt.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Access Type */}
                <div className="w-[180px]">
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className={`flex h-9 w-full items-center justify-between rounded-md border px-3 ${accessFilter ? 'border-primary-500' : 'border-neutral-300'} focus:border-primary-500 focus:ring-1 focus:ring-primary-500`}
                            >
                                {accessFilter || 'Access Type'}
                                <CaretDown size={20} className="text-neutral-500" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-3">
                            <div className="flex flex-col gap-2">
                                <h4 className="mb-1 text-xs font-medium text-neutral-500">
                                    Access Type
                                </h4>
                                {[
                                    { label: 'All', value: '' },
                                    ...Object.values(AccessType).map((a) => ({
                                        label: a.charAt(0).toUpperCase() + a.slice(1),
                                        value: a,
                                    })),
                                ].map((opt) => (
                                    <button
                                        key={opt.label}
                                        onClick={() => setAccessFilter(opt.value)}
                                        className={`w-full rounded-md border px-3 py-1.5 text-left text-sm ${accessFilter === opt.value ? 'text-primary-600 border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Streaming Service */}
                <div className="w-[180px]">
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className={`flex h-9 w-full items-center justify-between rounded-md border px-3 ${streamingServiceFilter ? 'border-primary-500' : 'border-neutral-300'} focus:border-primary-500 focus:ring-1 focus:ring-primary-500`}
                            >
                                {streamingServiceFilter || 'Platform'}
                                <CaretDown size={20} className="text-neutral-500" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-3">
                            <div className="flex flex-col gap-2">
                                <h4 className="mb-1 text-xs font-medium text-neutral-500">
                                    Streaming Platform
                                </h4>
                                {[
                                    { label: 'All', value: '' },
                                    { label: 'Zoom', value: 'zoom' },
                                    { label: 'Google Meet', value: 'google_meet' },
                                    { label: 'YouTube', value: 'youtube' },
                                    { label: 'Other', value: 'other' },
                                ].map((opt) => (
                                    <button
                                        key={opt.label}
                                        onClick={() => setStreamingServiceFilter(opt.value)}
                                        className={`w-full rounded-md border px-3 py-1.5 text-left text-sm ${streamingServiceFilter === opt.value ? 'text-primary-600 border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Batch Filter */}
                <div className="w-[220px]">
                    <SelectChips
                        options={batchOptions}
                        selected={selectedBatches}
                        onChange={handleBatchChange}
                        placeholder="Select Batches"
                        multiSelect={true}
                        hasClearFilter={false}
                        className="h-9"
                    />
                </div>

                {/* Clear filters */}
                <button
                    onClick={clearFilters}
                    className="h-9 rounded-md bg-neutral-100 px-3 text-sm hover:bg-neutral-200"
                >
                    Clear All
                </button>
            </div>
        </div>
    );

    useEffect(() => {
        setNavHeading(getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession) + 's');
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

        if (!searchResponse?.sessions || searchResponse.sessions.length === 0) {
            const tabLabel =
                selectedTab === SessionStatus.LIVE
                    ? 'Live'
                    : selectedTab === SessionStatus.UPCOMING
                        ? 'Upcoming'
                        : selectedTab === SessionStatus.PAST
                            ? 'Past'
                            : 'Draft';

            return (
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
            filteredSessions = searchResponse.sessions.filter((session) => {
                const sessionTimezone = session.timezone || 'Asia/Kolkata';

                // Construct session start and end times
                const sessionStartString = `${session.meeting_date}T${session.start_time}`;
                const sessionEndString = `${session.meeting_date}T${session.last_entry_time}`;

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
                            No {selectedTab === SessionStatus.UPCOMING ? 'upcoming' : 'past'} sessions on this page.
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
            <FilterBar />
            <Tabs value={selectedTab} onValueChange={handleTabChange}>
                <div className="flex justify-between">
                    <TabsList className="inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
                        {Object.values(SessionStatus).map((status) => (
                            <TabsTrigger
                                key={status}
                                value={status}
                                className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${selectedTab === status
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
