import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { convertToLocalDateTime } from '@/constants/helper';
import type { ColumnDef } from '@tanstack/react-table';
import { MyTable } from '@/components/design-system/table';
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    Megaphone,
    Search,
    Flame,
    CheckCircle2,
    UserPlus,
    Download,
} from 'lucide-react';
import { ArrowSquareOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { fetchRecentLeads, type RecentLeadDetail } from '../../list/-services/get-recent-leads';
import { handleFetchCampaignsList } from '../../list/-services/get-campaigns-list';
import { StudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-side-view';
import { StudentSidebarProvider } from '@/routes/manage-students/students-list/-providers/student-sidebar-provider';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import type { StudentTable } from '@/types/student-table-types';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import { useLeadProfiles, fetchBatchProfiles } from '@/hooks/use-lead-profiles';
import { useLatestNotesBatch, fetchLatestNotesBatch } from '@/hooks/use-latest-notes-batch';
import { LeadScoreBadge } from '@/components/shared/lead-score-badge';
import { AddLeadNoteDialog } from '@/components/shared/add-lead-note-dialog';
import { AssignCounselorToLeadDialog } from '@/components/shared/assign-counselor-to-lead-dialog';
import { LeadActivityNotesCell } from '@/components/shared/lead-activity-notes-cell';

const PAGE_SIZE = 20;
// Sentinel for "All audiences" — shadcn `<Select>` doesn't allow an empty
// string as an item value, so we use a non-empty marker and translate.
const ALL_AUDIENCES_VALUE = '__ALL__';
// Same sentinel pattern for the tier select — empty string is reserved.
const ALL_TIERS_VALUE = '__ALL__';
type LeadTier = 'HOT' | 'WARM' | 'COLD';
type ConversionFilter = 'EXCLUDE_CONVERTED' | 'ONLY_CONVERTED' | 'ALL';
const SEARCH_DEBOUNCE_MS = 500;

// Convert a date input value (yyyy-mm-dd) to an ISO timestamp at the start
// or end of that day in the user's local timezone. Returned as plain ISO so
// the backend can parse it into a Timestamp.
const startOfDayIso = (date: string): string | undefined => {
    if (!date) return undefined;
    const d = new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};
const endOfDayIso = (date: string): string | undefined => {
    if (!date) return undefined;
    const d = new Date(`${date}T23:59:59.999`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

// yyyy-mm-dd in local time (matches the format the native <input type="date"> uses).
const toDateInputValue = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// Default the page to the last 30 days so it lives up to its name. Users can
// widen or clear the range via the filter bar.
const RECENT_DEFAULT_DAYS = 30;
const computeDefaultRange = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (RECENT_DEFAULT_DAYS - 1));
    return { from: toDateInputValue(start), to: toDateInputValue(now) };
};

// Map a recent-lead row to a partial StudentTable so the shared StudentSidebar
// can render its tabs (notifications, lead profile, etc.) for this respondent.
// Only the fields available from the lead payload are populated; the rest are
// safe defaults — the side-view tabs handle missing data gracefully. We also
// stash `_response_fields` + `_audience_campaign_name` for the side-view's
// LeadFormResponseCard, derived from the row's custom_field_metadata.
const mapRecentLeadToStudent = (lead: RecentLeadDetail): StudentTable => {
    const u = lead.user ?? {};
    const userId = u.id || lead.user_id || lead.response_id || '';

    const responseFields: Array<{
        id: string;
        name: string;
        type: string;
        rawValue: string | null;
    }> = [];
    const cfv = lead.custom_field_values ?? {};
    const meta = lead.custom_field_metadata ?? {};
    Object.entries(cfv).forEach(([fieldId, rawVal]) => {
        const value = rawVal == null ? null : String(rawVal);
        if (value === null || value === '') return;
        const m = meta[fieldId] ?? {};
        const name = m.fieldName ?? m.field_name ?? fieldId;
        const type = m.fieldType ?? m.field_type ?? 'textfield';
        responseFields.push({ id: fieldId, name, type, rawValue: value });
    });

    const result: StudentTable = {
        id: userId,
        user_id: userId,
        full_name: u.full_name || lead.parent_name || '',
        email: u.email || lead.parent_email || '',
        username: null,
        mobile_number: u.mobile_number || lead.parent_mobile || '',
        gender: '',
        region: null,
        city: '',
        date_of_birth: '',
        created_at: '',
        address_line: '',
        attendance_percent: 0,
        referral_count: 0,
        pin_code: '',
        fathers_name: '',
        mothers_name: '',
        father_mobile_number: '',
        father_email: '',
        mother_mobile_number: '',
        mother_email: '',
        linked_institute_name: null,
        updated_at: '',
        package_session_id: '',
        institute_enrollment_id: '',
        status: 'INACTIVE',
        session_expiry_days: 0,
        institute_id: '',
        expiry_date: 0,
        face_file_id: null,
        parents_email: '',
        parents_mobile_number: '',
        parents_to_mother_email: '',
        parents_to_mother_mobile_number: '',
        destination_package_session_id: '',
        enroll_invite_id: '',
        payment_status: '',
        custom_fields: {},
    };
    // Stash for LeadFormResponseCard — kept off the canonical shape via cast.
    (result as unknown as Record<string, unknown>)._response_fields = responseFields;
    (result as unknown as Record<string, unknown>)._audience_campaign_name =
        lead.campaign_name ?? lead.source_audience_name ?? null;
    return result;
};

const displayName = (lead: RecentLeadDetail) => lead.user?.full_name || lead.parent_name || '-';
const displayEmail = (lead: RecentLeadDetail) => lead.user?.email || lead.parent_email || '-';
const displayPhone = (lead: RecentLeadDetail) =>
    lead.user?.mobile_number || lead.parent_mobile || '-';
const displayAudience = (lead: RecentLeadDetail) =>
    lead.campaign_name || lead.source_audience_name || '-';
const displaySubmittedAt = (lead: RecentLeadDetail) => {
    if (!lead.submitted_at_local) return '-';
    const d = new Date(lead.submitted_at_local);
    return Number.isNaN(d.getTime()) ? lead.submitted_at_local : format(d, 'MMM d, yyyy h:mm a');
};

export const RecentLeadsPage = () => {
    const { setNavHeading } = useNavHeadingStore();
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id;

    const [page, setPage] = useState(0);
    // Date filter: stored as yyyy-mm-dd strings to match the native date input.
    // Default to the last 30 days — the page is "Recent Leads" by name.
    const defaultRange = useMemo(() => computeDefaultRange(), []);
    const [fromDate, setFromDate] = useState(defaultRange.from);
    const [toDate, setToDate] = useState(defaultRange.to);
    const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>(defaultRange);
    // Audience filter: starts at "All audiences" so a sales rep sees the
    // freshest submissions from every campaign on landing.
    const [audienceId, setAudienceId] = useState<string>(ALL_AUDIENCES_VALUE);

    // Substring search across name / email / phone — applied with a debounce
    // so we don't fire a query on every keystroke. `searchInput` is what the
    // user is typing; `appliedSearch` is what the React Query key sees.
    const [searchInput, setSearchInput] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    useEffect(() => {
        const trimmed = searchInput.trim();
        if (trimmed === appliedSearch) return;
        const timer = window.setTimeout(() => {
            setAppliedSearch(trimmed);
            setPage(0);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchInput, appliedSearch]);

    // Lead tier filter — applied immediately (it's a discrete select).
    const [tierFilter, setTierFilter] = useState<string>(ALL_TIERS_VALUE);

    // Conversion-state filter. Default hides leads who've been assigned to a
    // course (the backend marks them CONVERTED on enrollment) so this view
    // stays focused on still-actionable leads.
    const [conversionFilter, setConversionFilter] = useState<ConversionFilter>('EXCLUDE_CONVERTED');

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Recent Leads</h1>);
    }, [setNavHeading]);

    // Fetch the audience list once for the filter dropdown. Pull a generous
    // page so even institutes with many campaigns see them all without paging.
    const audiencesQuery = useQuery(
        handleFetchCampaignsList({
            institute_id: instituteId ?? '',
            page: 0,
            size: 200,
        })
    );
    const audienceOptions = useMemo(
        () =>
            (audiencesQuery.data?.content ?? [])
                .map((c) => ({
                    id: c.id || c.campaign_id || c.audience_id || '',
                    name: c.campaign_name || 'Untitled audience',
                }))
                .filter((opt) => opt.id !== ''),
        [audiencesQuery.data]
    );

    const { data, isLoading, error } = useQuery({
        queryKey: [
            'recent-leads',
            instituteId,
            appliedRange.from,
            appliedRange.to,
            audienceId,
            appliedSearch,
            tierFilter,
            conversionFilter,
            page,
        ],
        queryFn: () =>
            fetchRecentLeads({
                institute_id: instituteId ?? '',
                audience_id: audienceId === ALL_AUDIENCES_VALUE ? undefined : audienceId,
                submitted_from_local: startOfDayIso(appliedRange.from),
                submitted_to_local: endOfDayIso(appliedRange.to),
                search_query: appliedSearch || undefined,
                lead_tier: tierFilter === ALL_TIERS_VALUE ? undefined : tierFilter,
                conversion_status_filter: conversionFilter,
                page,
                size: PAGE_SIZE,
            }),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });

    const totalPages = data?.totalPages ?? 0;

    const handleApplyFilter = () => {
        setPage(0);
        setAppliedRange({ from: fromDate, to: toDate });
    };

    const handleClearFilter = () => {
        setFromDate('');
        setToDate('');
        setAudienceId(ALL_AUDIENCES_VALUE);
        setSearchInput('');
        setAppliedSearch('');
        setTierFilter(ALL_TIERS_VALUE);
        setConversionFilter('EXCLUDE_CONVERTED');
        setPage(0);
        setAppliedRange({ from: '', to: '' });
    };

    const handleAudienceChange = (value: string) => {
        setPage(0);
        setAudienceId(value);
    };

    const handleTierChange = (value: string) => {
        setPage(0);
        setTierFilter(value);
    };

    const handleConversionChange = (value: string) => {
        setPage(0);
        setConversionFilter(value as ConversionFilter);
    };

    const isFilterActive =
        !!appliedRange.from ||
        !!appliedRange.to ||
        audienceId !== ALL_AUDIENCES_VALUE ||
        !!appliedSearch ||
        tierFilter !== ALL_TIERS_VALUE ||
        conversionFilter !== 'EXCLUDE_CONVERTED';

    // Match the Lead List CSV template — base columns + Counsellor / Activity
    // & Notes / Notes Count when the lead system is enabled. The hook here is
    // the same one the table calls; React Query caches it so this isn't a
    // duplicate fetch.
    const exportLeadSettings = useLeadSettings();
    const exportShowLeadOps = !exportLeadSettings.isLoading && exportLeadSettings.enabled;

    const [isExporting, setIsExporting] = useState(false);
    const EXPORT_PAGE_SIZE = 200;

    const handleExportCsv = async () => {
        if (!instituteId) return;
        setIsExporting(true);
        try {
            const allLeads: RecentLeadDetail[] = [];
            let pageNo = 0;
            let last = false;
            while (!last) {
                const resp = await fetchRecentLeads({
                    institute_id: instituteId,
                    audience_id: audienceId === ALL_AUDIENCES_VALUE ? undefined : audienceId,
                    submitted_from_local: startOfDayIso(appliedRange.from),
                    submitted_to_local: endOfDayIso(appliedRange.to),
                    search_query: appliedSearch || undefined,
                    lead_tier: tierFilter === ALL_TIERS_VALUE ? undefined : tierFilter,
                    conversion_status_filter: conversionFilter,
                    page: pageNo,
                    size: EXPORT_PAGE_SIZE,
                });
                if (resp?.content?.length) allLeads.push(...resp.content);
                last = resp?.last ?? true;
                pageNo += 1;
                if (pageNo > 200) break;
            }

            if (allLeads.length === 0) {
                toast.info('No leads to export for the current filters');
                return;
            }

            // One batch call each for profiles + notes across the entire export
            // set — keeps the export O(1) calls regardless of lead count.
            const userIds = Array.from(
                new Set(
                    allLeads
                        .map((l) => l.user?.id || l.user_id || '')
                        .filter((id): id is string => !!id)
                )
            );
            const [profiles, notes] = await Promise.all([
                exportShowLeadOps
                    ? fetchBatchProfiles(userIds)
                    : Promise.resolve({} as Awaited<ReturnType<typeof fetchBatchProfiles>>),
                exportShowLeadOps
                    ? fetchLatestNotesBatch(userIds)
                    : Promise.resolve({} as Awaited<ReturnType<typeof fetchLatestNotesBatch>>),
            ]);

            // CSV layout mirrors the Lead List export
            // (campaign-users-table.tsx#L820+): base columns first, then
            // Counsellor / Activity & Notes / Notes Count appended at the end.
            const safeString = (val: unknown) => {
                if (val === undefined || val === null) return '';
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            const baseHeaders = ['Lead ID', 'Submitted At', 'Name', 'Email', 'Mobile', 'Audience'];
            const tailHeaders = exportShowLeadOps
                ? ['Counsellor', 'Activity & Notes', 'Notes Count']
                : [];
            const csvHeaders = [...baseHeaders, ...tailHeaders];

            const csvRows = allLeads.map((lead) => {
                const u = lead.user ?? {};
                const userId = u.id || lead.user_id || '';
                const submittedAt = lead.submitted_at_local
                    ? convertToLocalDateTime(lead.submitted_at_local)
                    : '-';

                const row = [
                    safeString(lead.response_id || lead.user_id || '-'),
                    safeString(submittedAt),
                    safeString(u.full_name || lead.parent_name || '-'),
                    safeString(u.email || lead.parent_email || '-'),
                    safeString(u.mobile_number || lead.parent_mobile || '-'),
                    safeString(displayAudience(lead)),
                ];

                if (exportShowLeadOps) {
                    const counsellorName = userId
                        ? profiles[userId]?.assigned_counselor_name ?? ''
                        : '';
                    const noteSummary = userId ? notes[userId] : undefined;
                    const recent = noteSummary?.recent ?? [];
                    // Same formatting as Lead List:
                    //   1. {label} - {body}
                    //      updatedby - {actor}
                    //      date - {date}
                    const notesBlock = recent
                        .map((n, idx) => {
                            const label = n.title?.trim() || 'Note';
                            const body = n.description?.trim() || '';
                            const date = n.created_at ? convertToLocalDateTime(n.created_at) : '';
                            return [
                                `${idx + 1}. ${label} - ${body}`,
                                `   updatedby - ${n.actor_name || ''}`,
                                `   date - ${date}`,
                            ].join('\n');
                        })
                        .join('\n\n');
                    row.push(safeString(counsellorName));
                    row.push(safeString(notesBlock));
                    row.push(safeString(noteSummary?.count ?? 0));
                }

                return row.join(',');
            });

            const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `recent_leads_${format(new Date(), 'yyyy-MM-dd')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success(`Exported ${allLeads.length} leads`);
        } catch (err) {
            console.error('Recent leads export failed:', err);
            toast.error('Failed to export recent leads');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <StudentSidebarProvider>
            <div className="flex w-full flex-col gap-4">
                {/* Filter bar */}
                <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
                        <Label htmlFor="recent-leads-search" className="text-xs text-neutral-600">
                            Search
                        </Label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Input
                                id="recent-leads-search"
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Name, email or phone"
                                className="w-full pl-7"
                                aria-label="Search leads by name, email or phone"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="recent-leads-audience" className="text-xs text-neutral-600">
                            Audience
                        </Label>
                        <div className="relative">
                            <Megaphone className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Select value={audienceId} onValueChange={handleAudienceChange}>
                                <SelectTrigger id="recent-leads-audience" className="w-56 pl-7">
                                    <SelectValue placeholder="All audiences" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_AUDIENCES_VALUE}>
                                        All audiences
                                    </SelectItem>
                                    {audienceOptions.map((opt) => (
                                        <SelectItem key={opt.id} value={opt.id}>
                                            {opt.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="recent-leads-tier" className="text-xs text-neutral-600">
                            Lead tier
                        </Label>
                        <div className="relative">
                            <Flame className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Select value={tierFilter} onValueChange={handleTierChange}>
                                <SelectTrigger id="recent-leads-tier" className="w-44 pl-7">
                                    <SelectValue placeholder="All tiers" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_TIERS_VALUE}>All tiers</SelectItem>
                                    <SelectItem value={'HOT' satisfies LeadTier}>Hot</SelectItem>
                                    <SelectItem value={'WARM' satisfies LeadTier}>Warm</SelectItem>
                                    <SelectItem value={'COLD' satisfies LeadTier}>Cold</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label
                            htmlFor="recent-leads-conversion"
                            className="text-xs text-neutral-600"
                        >
                            Status
                        </Label>
                        <div className="relative">
                            <CheckCircle2 className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Select value={conversionFilter} onValueChange={handleConversionChange}>
                                <SelectTrigger id="recent-leads-conversion" className="w-48 pl-7">
                                    <SelectValue placeholder="Active leads" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="EXCLUDE_CONVERTED">Active leads</SelectItem>
                                    <SelectItem value="ONLY_CONVERTED">Converted only</SelectItem>
                                    <SelectItem value="ALL">All</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="recent-leads-from" className="text-xs text-neutral-600">
                            Submitted From
                        </Label>
                        <div className="relative">
                            <Calendar className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Input
                                id="recent-leads-from"
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="w-44 pl-7"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="recent-leads-to" className="text-xs text-neutral-600">
                            Submitted To
                        </Label>
                        <div className="relative">
                            <Calendar className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Input
                                id="recent-leads-to"
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="w-44 pl-7"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleApplyFilter}>
                            Apply
                        </Button>
                        {isFilterActive && (
                            <Button size="sm" variant="ghost" onClick={handleClearFilter}>
                                Clear
                            </Button>
                        )}
                    </div>
                    <div className="ml-auto text-xs text-neutral-500">
                        {data ? `${data.totalElements} total` : ''}
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-neutral-500">
                        {data ? `${data.totalElements} total` : ''}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExportCsv}
                        disabled={isExporting || !data?.totalElements}
                    >
                        <Download className="mr-1.5 size-4" />
                        {isExporting ? 'Exporting…' : 'Export CSV'}
                    </Button>
                </div>
            </div>
            <RecentLeadsTable data={data} isLoading={isLoading} error={error} />

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                    >
                        <ChevronLeft className="mr-1 size-4" />
                        Previous
                    </Button>
                    <span className="text-xs text-neutral-600">
                        Page {page + 1} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                    >
                        Next
                        <ChevronRight className="ml-1 size-4" />
                    </Button>
                </div>
            )}
        </StudentSidebarProvider>
    );
};

interface RecentLeadsTableProps {
    data: { content: RecentLeadDetail[]; totalElements: number } | undefined;
    isLoading: boolean;
    error: unknown;
}

// Table body with the shared StudentSidebar wired up. Lives in its own
// SidebarProvider so the Details icon (per row) toggles only this side view —
// matching the manage-contacts and campaign-users pattern for consistency.
const RecentLeadsTable = ({ data, isLoading, error }: RecentLeadsTableProps) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { setSelectedStudent } = useStudentSidebar();

    const leadSettings = useLeadSettings();
    // Show lead-score badges only when the lead system is on AND the institute
    // has the per-table flag enabled. Recent Leads is treated as an enquiry
    // surface for this gate (these are raw form submissions).
    const showLeadScore =
        !leadSettings.isLoading && leadSettings.enabled && leadSettings.showScoreInEnquiryTable;
    // Counsellor + Notes columns are gated on the lead system being on (but
    // not on the per-table score flag, so admins can still see/edit them
    // even when score badges are hidden).
    const showLeadOps = !leadSettings.isLoading && leadSettings.enabled;
    const leadUserIds = useMemo(
        () =>
            (data?.content ?? [])
                .map((l) => l.user?.id || l.user_id || '')
                .filter((id): id is string => !!id),
        [data]
    );
    const { profiles: leadProfiles } = useLeadProfiles(leadUserIds, showLeadScore);
    // Independent profile fetch for the Counsellor column — runs even when
    // score badges are off.
    const { profiles: counsellorProfiles } = useLeadProfiles(leadUserIds, showLeadOps);
    const { notesByUserId } = useLatestNotesBatch(leadUserIds, showLeadOps);

    // Dialog state lives at the table level so a single mount serves every row.
    const [noteTarget, setNoteTarget] = useState<{ userId: string; userName: string } | null>(null);
    const [counsellorTarget, setCounsellorTarget] = useState<{
        userId: string;
        userName: string;
    } | null>(null);

    const handleSelectLead = useCallback(
        (lead: RecentLeadDetail) => {
            setSelectedStudent(mapRecentLeadToStudent(lead));
        },
        [setSelectedStudent]
    );

    // Columns are built with the same `ColumnDef<T>` shape used by the Lead
    // List so MyTable renders both pages identically (header styles, row
    // dividers, cell padding, scroll behaviour).
    const columns = useMemo<ColumnDef<RecentLeadDetail>[]>(() => {
        const cols: ColumnDef<RecentLeadDetail>[] = [
            {
                id: 'details',
                header: 'Details',
                size: 80,
                minSize: 60,
                maxSize: 100,
                cell: ({ row }) => (
                    <div className="p-3">
                        <SidebarTrigger
                            onClick={() => handleSelectLead(row.original)}
                            aria-label={`Open details for ${displayName(row.original)}`}
                        >
                            <ArrowSquareOut className="size-5 cursor-pointer text-neutral-600" />
                        </SidebarTrigger>
                    </div>
                ),
            },
            {
                id: 'name',
                header: 'Name',
                size: 200,
                minSize: 160,
                maxSize: 260,
                cell: ({ row }) => {
                    const lead = row.original;
                    const userId = lead.user?.id || lead.user_id || '';
                    const profile = showLeadScore && userId ? leadProfiles[userId] : undefined;
                    return (
                        <div className="flex flex-col gap-0.5 p-3 font-medium text-neutral-900">
                            <span>{displayName(lead)}</span>
                            {profile && (
                                <LeadScoreBadge
                                    score={profile.best_score}
                                    tier={profile.lead_tier}
                                    size="sm"
                                />
                            )}
                        </div>
                    );
                },
            },
            {
                id: 'email',
                header: 'Email',
                size: 240,
                minSize: 200,
                maxSize: 320,
                cell: ({ row }) => (
                    <div className="p-3 text-sm text-neutral-700">{displayEmail(row.original)}</div>
                ),
            },
            {
                id: 'phone',
                header: 'Phone',
                size: 160,
                minSize: 140,
                maxSize: 200,
                cell: ({ row }) => (
                    <div className="p-3 text-sm text-neutral-700">{displayPhone(row.original)}</div>
                ),
            },
            {
                id: 'audience',
                header: 'Audience',
                size: 180,
                minSize: 150,
                maxSize: 220,
                cell: ({ row }) => (
                    <div className="p-3 text-sm text-neutral-700">
                        {displayAudience(row.original)}
                    </div>
                ),
            },
        ];

        if (showLeadOps) {
            cols.push({
                id: 'counsellor',
                header: 'Counsellor',
                size: 200,
                minSize: 160,
                maxSize: 240,
                cell: ({ row }) => {
                    const lead = row.original;
                    const userId = lead.user?.id || lead.user_id || '';
                    const leadName = displayName(lead);
                    const counsellorName = userId
                        ? counsellorProfiles[userId]?.assigned_counselor_name ?? null
                        : null;
                    if (!userId) {
                        return <div className="p-3 text-sm text-neutral-400">—</div>;
                    }
                    if (counsellorName) {
                        return (
                            <div className="flex items-center justify-between gap-2 p-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700">
                                        {counsellorName[0]?.toUpperCase()}
                                    </div>
                                    <span className="truncate text-sm text-neutral-800">
                                        {counsellorName}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCounsellorTarget({ userId, userName: leadName });
                                    }}
                                    className="shrink-0 text-[11px] text-neutral-400 hover:text-primary-600"
                                >
                                    Reassign
                                </button>
                            </div>
                        );
                    }
                    return (
                        <div className="p-3">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCounsellorTarget({ userId, userName: leadName });
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:border-primary-300 hover:text-primary-600"
                            >
                                <UserPlus className="size-3.5" />
                                Assign
                            </button>
                        </div>
                    );
                },
            });
            cols.push({
                id: 'activity_notes',
                header: 'Activity & Notes',
                size: 320,
                minSize: 260,
                maxSize: 420,
                cell: ({ row }) => {
                    const lead = row.original;
                    const userId = lead.user?.id || lead.user_id || '';
                    const leadName = displayName(lead);
                    if (!userId) {
                        return <div className="p-3 text-sm text-neutral-400">—</div>;
                    }
                    const summary = notesByUserId[userId];
                    const recent = summary?.recent ?? [];
                    return (
                        <div className="p-2">
                            <LeadActivityNotesCell
                                recent={recent}
                                count={summary?.count ?? recent.length}
                                onAdd={() => setNoteTarget({ userId, userName: leadName })}
                            />
                        </div>
                    );
                },
            });
        }

        cols.push({
            id: 'submitted_at',
            header: 'Submitted On',
            size: 200,
            minSize: 160,
            maxSize: 240,
            cell: ({ row }) => (
                <div className="p-3 text-sm text-neutral-700">
                    {displaySubmittedAt(row.original)}
                </div>
            ),
        });

        return cols;
    }, [
        showLeadOps,
        showLeadScore,
        leadProfiles,
        counsellorProfiles,
        notesByUserId,
        handleSelectLead,
    ]);

    const tableData = useMemo(() => {
        if (!data) return undefined;
        return {
            content: data.content,
            total_pages: 0,
            page_no: 0,
            page_size: data.content.length,
            total_elements: data.totalElements,
            last: true,
        };
    }, [data]);

    return (
        <SidebarProvider
            style={{ ['--sidebar-width' as string]: '565px' }}
            defaultOpen={false}
            open={isSidebarOpen}
            onOpenChange={setIsSidebarOpen}
        >
            <div className="min-w-0 flex-1 rounded-md shadow-sm">
                {!isLoading && !error && data && data.content.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white px-6 py-16 text-center">
                        <p className="text-sm font-medium text-neutral-700">No leads found</p>
                        <p className="text-xs text-neutral-500">
                            Try adjusting the filters or clearing them to see more results.
                        </p>
                    </div>
                ) : (
                    <MyTable<RecentLeadDetail>
                        data={tableData}
                        columns={columns}
                        isLoading={isLoading}
                        error={error}
                        currentPage={0}
                        tableState={{ columnVisibility: {} }}
                    />
                )}
            </div>
            <StudentSidebar selectedTab="overview" examType="EXAM" isStudentList={false} />

            {noteTarget && (
                <AddLeadNoteDialog
                    open={!!noteTarget}
                    onOpenChange={(o) => !o && setNoteTarget(null)}
                    userId={noteTarget.userId}
                    userName={noteTarget.userName}
                />
            )}

            {counsellorTarget && (
                <AssignCounselorToLeadDialog
                    open={!!counsellorTarget}
                    onOpenChange={(o) => !o && setCounsellorTarget(null)}
                    userId={counsellorTarget.userId}
                    userName={counsellorTarget.userName}
                    invalidateKeys={[['lead-profiles-batch']]}
                />
            )}
        </SidebarProvider>
    );
};
