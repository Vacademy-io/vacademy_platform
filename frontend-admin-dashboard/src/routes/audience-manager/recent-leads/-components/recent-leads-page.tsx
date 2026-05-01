import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Megaphone } from 'lucide-react';
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
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { fetchRecentLeads, type RecentLeadDetail } from '../../list/-services/get-recent-leads';
import { handleFetchCampaignsList } from '../../list/-services/get-campaigns-list';
import { StudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-side-view';
import { StudentSidebarProvider } from '@/routes/manage-students/students-list/-providers/student-sidebar-provider';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import type { StudentTable } from '@/types/student-table-types';

const PAGE_SIZE = 20;
// Sentinel for "All audiences" — shadcn `<Select>` doesn't allow an empty
// string as an item value, so we use a non-empty marker and translate.
const ALL_AUDIENCES_VALUE = '__ALL__';

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
// safe defaults — the side-view tabs handle missing data gracefully.
const mapRecentLeadToStudent = (lead: RecentLeadDetail): StudentTable => {
    const u = lead.user ?? {};
    const userId = u.id || lead.user_id || lead.response_id || '';
    return {
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
            page,
        ],
        queryFn: () =>
            fetchRecentLeads({
                institute_id: instituteId ?? '',
                audience_id:
                    audienceId === ALL_AUDIENCES_VALUE ? undefined : audienceId,
                submitted_from_local: startOfDayIso(appliedRange.from),
                submitted_to_local: endOfDayIso(appliedRange.to),
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
        setPage(0);
        setAppliedRange({ from: '', to: '' });
    };

    const handleAudienceChange = (value: string) => {
        setPage(0);
        setAudienceId(value);
    };

    const isFilterActive =
        !!appliedRange.from ||
        !!appliedRange.to ||
        audienceId !== ALL_AUDIENCES_VALUE;

    return (
        <StudentSidebarProvider>
        <div className="flex w-full flex-col gap-4">
            {/* Filter bar */}
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-1">
                    <Label htmlFor="recent-leads-audience" className="text-xs text-neutral-600">
                        Audience
                    </Label>
                    <div className="relative">
                        <Megaphone className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                        <Select value={audienceId} onValueChange={handleAudienceChange}>
                            <SelectTrigger
                                id="recent-leads-audience"
                                className="w-56 pl-7"
                            >
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

            {/* Table + side view: lives inside its own SidebarProvider so the
                Details icon can toggle the StudentSidebar without affecting
                any outer sidebars. */}
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
        </div>
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

    const handleSelectLead = useCallback(
        (lead: RecentLeadDetail) => {
            setSelectedStudent(mapRecentLeadToStudent(lead));
        },
        [setSelectedStudent]
    );

    return (
        <SidebarProvider
            style={{ ['--sidebar-width' as string]: '565px' }}
            defaultOpen={false}
            open={isSidebarOpen}
            onOpenChange={setIsSidebarOpen}
        >
            <div className="flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                {isLoading ? (
                    <div className="flex flex-col items-center gap-2 py-12">
                        <DashboardLoader />
                        <p className="animate-pulse text-xs text-neutral-500">Loading leads...</p>
                    </div>
                ) : error ? (
                    <div className="flex h-60 items-center justify-center">
                        <p className="text-sm text-red-500">Failed to load leads.</p>
                    </div>
                ) : !data || data.content.length === 0 ? (
                    <div className="flex h-60 items-center justify-center">
                        <p className="text-sm text-neutral-500">No leads found.</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                            <tr>
                                <th className="w-20 px-4 py-3">Details</th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Phone</th>
                                <th className="px-4 py-3">Audience</th>
                                <th className="px-4 py-3">Submitted On</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.content.map((lead, idx) => (
                                <tr
                                    key={lead.response_id ?? idx}
                                    className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50"
                                >
                                    <td className="px-4 py-3">
                                        <SidebarTrigger
                                            onClick={() => handleSelectLead(lead)}
                                            aria-label={`Open details for ${displayName(lead)}`}
                                        >
                                            <ArrowSquareOut className="size-5 cursor-pointer text-neutral-600" />
                                        </SidebarTrigger>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-neutral-900">
                                        {displayName(lead)}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-700">
                                        {displayEmail(lead)}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-700">
                                        {displayPhone(lead)}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-700">
                                        {displayAudience(lead)}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-700">
                                        {displaySubmittedAt(lead)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <StudentSidebar selectedTab="overview" examType="EXAM" isStudentList={false} />
        </SidebarProvider>
    );
};
