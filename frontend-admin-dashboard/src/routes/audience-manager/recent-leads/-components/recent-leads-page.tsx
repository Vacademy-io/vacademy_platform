import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { convertToLocalDateTime } from '@/constants/helper';
import { parseHtmlToString } from '@/lib/utils';
import {
    DownloadSimple,
    MagnifyingGlass,
    X,
    Flame,
    CheckCircle,
    Columns,
    Clock,
    Megaphone,
    CalendarBlank,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { fetchRecentLeads, type RecentLeadDetail } from '../../list/-services/get-recent-leads';
import { handleFetchCampaignsList } from '../../list/-services/get-campaigns-list';
import { StudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-side-view';
import { StudentSidebarProvider } from '@/routes/manage-students/students-list/-providers/student-sidebar-provider';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import { useLeadProfiles, fetchBatchProfiles } from '@/hooks/use-lead-profiles';
import { useLatestNotesBatch, fetchLatestNotesBatch } from '@/hooks/use-latest-notes-batch';
import { useLeadStatuses } from '@/hooks/use-lead-statuses';
import { fetchCounselors } from '@/routes/settings/leads/pools/-components/schedule/shared';
import { CounsellorFilter } from '@/components/shared/leads/counsellor-filter';
import { AddLeadNoteDialog } from '@/components/shared/add-lead-note-dialog';
import { AssignCounselorToLeadDialog } from '@/components/shared/assign-counselor-to-lead-dialog';
import {
    LeadEmptyState,
    LeadTable,
    LeadPagination,
    useUpdateLeadTier,
    usePlaceCall,
    recentLeadToVM,
    type LeadActionHandlers,
} from '@/components/shared/leads';

import {
    ALL_AUDIENCES_VALUE,
    ALL_TIERS_VALUE,
    ALL_ACTIVE_VALUE,
    ALL_STATUSES_VALUE,
    ALL_SLA_VALUE,
    ALL_COUNSELLORS_VALUE,
    ALL_DATE_VALUE,
    CUSTOM_DATE_VALUE,
    DEFAULT_RANGE_DAYS,
} from './recent-leads-search';

type SlaFilter =
    | 'TAT_BEFORE'
    | 'TAT_OVERDUE'
    | 'FOLLOW_UP_DUE'
    | 'FOLLOW_UP_OVERDUE'
    | 'ANY_OVERDUE';
const SLA_OPTIONS: { value: string; label: string; helper?: string }[] = [
    { value: ALL_SLA_VALUE, label: 'All action statuses' },
    {
        value: 'ANY_OVERDUE',
        label: 'Any deadline missed',
        helper: 'First contact or follow-up — whichever is overdue',
    },
    { value: 'TAT_OVERDUE', label: 'First contact missed' },
    { value: 'TAT_BEFORE', label: 'First contact coming up' },
    { value: 'FOLLOW_UP_DUE', label: 'Follow-up coming up' },
    { value: 'FOLLOW_UP_OVERDUE', label: 'Follow-up missed' },
];
const SEARCH_DEBOUNCE_MS = 500;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

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
const toDateInputValue = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
// Date filter is a preset day-range select (no custom calendar) so a counsellor
// can switch windows in one click. "ALL" disables the submitted-date filter.
// (Preset sentinels live in ./recent-leads-search so URL deep-links share them.)
const DATE_RANGE_OPTIONS: { value: string; label: string }[] = [
    { value: '1', label: 'Last 24 hours' },
    { value: '7', label: 'Last 7 days' },
    { value: '15', label: 'Last 15 days' },
    { value: '30', label: 'Last 30 days' },
    { value: ALL_DATE_VALUE, label: 'All time' },
    { value: CUSTOM_DATE_VALUE, label: 'Custom range' },
];
const rangeForPreset = (preset: string): { from: string; to: string } => {
    if (preset === ALL_DATE_VALUE) return { from: '', to: '' };
    const n = Number(preset);
    if (!Number.isFinite(n) || n <= 0) return { from: '', to: '' };
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (n - 1));
    return { from: toDateInputValue(start), to: toDateInputValue(now) };
};

const displayAudience = (lead: RecentLeadDetail) =>
    lead.campaign_name || lead.source_audience_name || '-';
const csvSafe = (val: unknown) => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

/**
 * Single SLA-filter option content. Pulled out of the inline JSX so the
 * RecentLeadsContent function stays under CodeFactor's complexity threshold.
 * When `helper` is set, render the two-line label + subtitle pattern.
 */
const SlaOptionLabel = ({ label, helper }: { label: string; helper?: string }) => {
    if (!helper) return <>{label}</>;
    return (
        <div className="flex flex-col">
            <span>{label}</span>
            <span className="text-caption text-muted-foreground">{helper}</span>
        </div>
    );
};

export const RecentLeadsPage = () => {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Recent Leads</h1>);
    }, [setNavHeading]);
    return (
        <StudentSidebarProvider>
            <RecentLeadsContent />
        </StudentSidebarProvider>
    );
};

const RecentLeadsContent = () => {
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id;
    const { setSelectedStudent } = useStudentSidebar();
    const queryClient = useQueryClient();

    // Filters are URL-driven: state seeds from the search params on mount
    // (drill-through links from Reports / Sales Dashboard land here) and the
    // effect below writes every change back with replace:true — same pattern
    // as the Follow-ups page (use-follow-ups-view-state.ts).
    const urlSearch = useSearch({ from: '/audience-manager/recent-leads/' });
    const navigate = useNavigate({ from: '/audience-manager/recent-leads/' });

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [rangeDays, setRangeDays] = useState<string>(
        () =>
            urlSearch.range ??
            (urlSearch.from || urlSearch.to ? CUSTOM_DATE_VALUE : DEFAULT_RANGE_DAYS)
    );
    // Custom-range state (only used when rangeDays === CUSTOM_DATE_VALUE).
    const [customFrom, setCustomFrom] = useState(urlSearch.from ?? '');
    const [customTo, setCustomTo] = useState(urlSearch.to ?? '');
    const [customOpen, setCustomOpen] = useState(false);
    const appliedRange = useMemo(
        () =>
            rangeDays === CUSTOM_DATE_VALUE
                ? { from: customFrom, to: customTo }
                : rangeForPreset(rangeDays),
        [rangeDays, customFrom, customTo]
    );
    const [audienceId, setAudienceId] = useState<string>(
        urlSearch.audience ?? ALL_AUDIENCES_VALUE
    );

    const [searchInput, setSearchInput] = useState(urlSearch.search ?? '');
    const [appliedSearch, setAppliedSearch] = useState(urlSearch.search ?? '');
    useEffect(() => {
        const trimmed = searchInput.trim();
        if (trimmed === appliedSearch) return;
        const timer = window.setTimeout(() => {
            setAppliedSearch(trimmed);
            setPage(0);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchInput, appliedSearch]);

    const [tierFilter, setTierFilter] = useState<string>(urlSearch.tier ?? ALL_TIERS_VALUE);
    // Unified Lead Status filter — combines pipeline status + conversion state:
    //   ALL_ACTIVE_VALUE   → all leads except Converted (default)
    //   ALL_STATUSES_VALUE → every lead regardless of status
    //   <statusKey>        → only leads currently in that custom status
    const [leadStatusFilter, setLeadStatusFilter] = useState<string>(
        urlSearch.status ?? ALL_ACTIVE_VALUE
    );
    // SLA-state filter — maps to `audience_response.tat_reminder_stage` (and live-derived
    // `submitted_at + tatHours` for TAT buckets). ALL_SLA_VALUE = no filter.
    const [slaFilter, setSlaFilter] = useState<string>(urlSearch.sla ?? ALL_SLA_VALUE);
    // Counsellor filter — userId of the assigned counsellor. Empty = all counsellors.
    const [counsellorFilter, setCounsellorFilter] = useState<string>(
        urlSearch.counsellor ?? ALL_COUNSELLORS_VALUE
    );
    // Source-type filter — URL-only for now (no dropdown); drill-through links
    // from the Reports source breakdown set it. Empty string = all sources.
    const [sourceFilter, setSourceFilter] = useState<string>(urlSearch.source ?? '');

    // Write the applied filters back to the URL (replace, not push — filter
    // tweaks shouldn't pollute browser history). Defaults are omitted so the
    // bare /recent-leads URL stays clean.
    useEffect(() => {
        void navigate({
            search: {
                status: leadStatusFilter === ALL_ACTIVE_VALUE ? undefined : leadStatusFilter,
                tier: tierFilter === ALL_TIERS_VALUE ? undefined : tierFilter,
                sla: slaFilter === ALL_SLA_VALUE ? undefined : slaFilter,
                counsellor:
                    counsellorFilter === ALL_COUNSELLORS_VALUE ? undefined : counsellorFilter,
                audience: audienceId === ALL_AUDIENCES_VALUE ? undefined : audienceId,
                search: appliedSearch || undefined,
                range: rangeDays === DEFAULT_RANGE_DAYS ? undefined : rangeDays,
                from: rangeDays === CUSTOM_DATE_VALUE && customFrom ? customFrom : undefined,
                to: rangeDays === CUSTOM_DATE_VALUE && customTo ? customTo : undefined,
                source: sourceFilter || undefined,
            },
            replace: true,
        });
    }, [
        navigate,
        leadStatusFilter,
        tierFilter,
        slaFilter,
        counsellorFilter,
        audienceId,
        appliedSearch,
        rangeDays,
        customFrom,
        customTo,
        sourceFilter,
    ]);
    const counsellorOptionsQuery = useQuery({
        queryKey: ['counsellor-options', instituteId],
        queryFn: fetchCounselors,
        enabled: !!instituteId,
        staleTime: 5 * 60 * 1000,
    });
    const counsellorOptions = counsellorOptionsQuery.data ?? [];

    const leadSettings = useLeadSettings();
    const showOps = !leadSettings.isLoading && leadSettings.enabled;
    const showScore = showOps && leadSettings.showScoreInEnquiryTable;

    // Custom lead-status catalog — drives both the filter dropdown and the
    // editable status chip in the table.
    const { statuses: leadStatusCatalog } = useLeadStatuses();

    // Table UI state
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

    const [noteTarget, setNoteTarget] = useState<{
        userId: string;
        userName: string;
        responseId?: string;
    } | null>(null);
    const [counsellorTarget, setCounsellorTarget] = useState<{
        userId: string;
        userName: string;
    } | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // "Manage Column" toggle list — only the columns actually visible for the
    // current config (the Lead-name column is always shown).
    const toggleableColumns = useMemo(() => {
        const cols: { id: string; label: string }[] = [
            { id: 'contact', label: 'Contact' },
            { id: 'source', label: 'Lead source' },
        ];
        if (showOps) cols.push({ id: 'status', label: 'Lead status' });
        if (showScore) cols.push({ id: 'score', label: 'Lead score' });
        if (showOps) {
            cols.push(
                { id: 'tier', label: 'Tier' },
                { id: 'reachout', label: 'Reach out in' },
                { id: 'followup', label: 'Follow up at' },
                { id: 'owner', label: 'Lead owner' },
                { id: 'activity', label: 'Activity' }
            );
        }
        cols.push({ id: 'submitted', label: 'Submitted' });
        return cols;
    }, [showOps, showScore]);

    const audiencesQuery = useQuery(
        handleFetchCampaignsList({ institute_id: instituteId ?? '', page: 0, size: 200 })
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

    // Translate the unified status filter into the two backend params.
    const leadStatusId =
        leadStatusFilter === ALL_ACTIVE_VALUE || leadStatusFilter === ALL_STATUSES_VALUE
            ? undefined
            : leadStatusFilter;
    const conversionFilter: 'EXCLUDE_CONVERTED' | 'ALL' =
        leadStatusFilter === ALL_ACTIVE_VALUE ? 'EXCLUDE_CONVERTED' : 'ALL';

    const { data, isLoading, error } = useQuery({
        queryKey: [
            'recent-leads',
            instituteId,
            appliedRange.from,
            appliedRange.to,
            audienceId,
            appliedSearch,
            tierFilter,
            leadStatusFilter,
            leadStatusId,
            conversionFilter,
            slaFilter,
            counsellorFilter,
            ALL_COUNSELLORS_VALUE,
            sourceFilter,
            page,
            pageSize,
        ],
        queryFn: () =>
            fetchRecentLeads({
                institute_id: instituteId ?? '',
                audience_id: audienceId === ALL_AUDIENCES_VALUE ? undefined : audienceId,
                submitted_from_local: startOfDayIso(appliedRange.from),
                submitted_to_local: endOfDayIso(appliedRange.to),
                search_query: appliedSearch || undefined,
                lead_tier: tierFilter === ALL_TIERS_VALUE ? undefined : tierFilter,
                lead_status_id: leadStatusId,
                conversion_status_filter: conversionFilter,
                sla_filter: slaFilter === ALL_SLA_VALUE ? undefined : (slaFilter as SlaFilter),
                assigned_counselor_id:
                    counsellorFilter === ALL_COUNSELLORS_VALUE ? undefined : counsellorFilter,
                source_type: sourceFilter || undefined,
                page,
                size: pageSize,
            }),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });

    const totalPages = data?.totalPages ?? 0;
    const totalElements = data?.totalElements ?? 0;

    const vms = useMemo(() => (data?.content ?? []).map(recentLeadToVM), [data]);
    const userIds = useMemo(
        () =>
            (data?.content ?? [])
                .map((l) => l.user?.id || l.user_id || '')
                .filter((id): id is string => !!id),
        [data]
    );
    const { profiles: leadProfiles } = useLeadProfiles(userIds, showOps);
    const { notesByUserId } = useLatestNotesBatch(userIds, showOps);

    const invalidateKeys = [['recent-leads'], ['lead-profiles-batch']];
    const updateTier = useUpdateLeadTier({ invalidateKeys });
    const placeCall = usePlaceCall({ invalidateKeys });

    const actions: LeadActionHandlers = useMemo(
        () => ({
            onOpenDetails: (vm) => {
                // Open the compact side-view sheet, NOT the fullscreen overlay.
                setSelectedStudent(vm.toStudent(), { openOverlay: false });
                setIsSidebarOpen(true);
            },
            onAddNote: (userId, userName, responseId) =>
                setNoteTarget({ userId, userName, responseId }),
            onAssignCounsellor: (userId, userName) => setCounsellorTarget({ userId, userName }),
            onSetTier: (userId, _userName, tier) => updateTier.mutate({ userId, tier }),
            onCallLead: (vm, preferredNumberId) => {
                if (!vm.responseId) return;
                placeCall.mutate({
                    responseId: vm.responseId,
                    userId: vm.userId ?? undefined,
                    preferredNumberId,
                });
            },
            canCall: (vm) => {
                if (!vm.responseId) return { allowed: false, reason: 'Lead has no submission id' };
                const phone = vm.phone && vm.phone !== '-' ? vm.phone : '';
                if (!phone) return { allowed: false, reason: 'Lead has no phone on file' };
                if (placeCall.isPending)
                    return { allowed: false, reason: 'Another call is starting…' };
                return { allowed: true };
            },
        }),
        [setSelectedStudent, updateTier, placeCall]
    );

    const handleStatusUpdated = () => queryClient.invalidateQueries({ queryKey: ['recent-leads'] });

    const toggleColumn = (id: string) =>
        setHiddenColumns((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    // Filters
    const handleClearFilter = () => {
        setAudienceId(ALL_AUDIENCES_VALUE);
        setSearchInput('');
        setAppliedSearch('');
        setTierFilter(ALL_TIERS_VALUE);
        setLeadStatusFilter(ALL_ACTIVE_VALUE);
        setSlaFilter(ALL_SLA_VALUE);
        setCounsellorFilter(ALL_COUNSELLORS_VALUE);
        setSourceFilter('');
        setRangeDays(DEFAULT_RANGE_DAYS);
        setCustomFrom('');
        setCustomTo('');
        setPage(0);
    };
    const setDateRange = (value: string) => {
        setPage(0);
        setRangeDays(value);
        if (value === CUSTOM_DATE_VALUE) {
            // Seed the custom inputs with the last 30 days so a counsellor can
            // tweak from a sensible starting point instead of empty fields.
            if (!customFrom && !customTo) {
                const seed = rangeForPreset(DEFAULT_RANGE_DAYS);
                setCustomFrom(seed.from);
                setCustomTo(seed.to);
            }
            setCustomOpen(true);
        }
    };
    const setCounsellor = (value: string) => {
        setPage(0);
        setCounsellorFilter(value);
    };
    const setTier = (value: string) => {
        setPage(0);
        setTierFilter(value);
    };
    const setLeadStatus = (value: string) => {
        setPage(0);
        setLeadStatusFilter(value);
    };
    const setSla = (value: string) => {
        setPage(0);
        setSlaFilter(value);
    };
    const handleAudienceChange = (value: string) => {
        setPage(0);
        setAudienceId(value);
    };

    const isFilterActive =
        rangeDays !== DEFAULT_RANGE_DAYS ||
        audienceId !== ALL_AUDIENCES_VALUE ||
        !!appliedSearch ||
        tierFilter !== ALL_TIERS_VALUE ||
        leadStatusFilter !== ALL_ACTIVE_VALUE ||
        slaFilter !== ALL_SLA_VALUE ||
        counsellorFilter !== ALL_COUNSELLORS_VALUE ||
        !!sourceFilter;

    // CSV export (shared by "Export" + "Export selected")
    const [isExporting, setIsExporting] = useState(false);
    const exportLeadsCsv = async (leads: RecentLeadDetail[], prefix: string) => {
        if (leads.length === 0) {
            toast.info('No leads to export');
            return;
        }
        const ids = Array.from(
            new Set(leads.map((l) => l.user?.id || l.user_id || '').filter(Boolean))
        ) as string[];
        const [prof, nts] = await Promise.all([
            showOps ? fetchBatchProfiles(ids) : Promise.resolve({}),
            showOps ? fetchLatestNotesBatch(ids) : Promise.resolve({}),
        ]);
        const baseHeaders = ['Lead ID', 'Submitted At', 'Name', 'Email', 'Mobile', 'Audience'];
        const tail = showOps ? ['Status', 'Counsellor', 'Activity & Notes', 'Notes Count'] : [];
        const rows = leads.map((lead) => {
            const u = lead.user ?? {};
            const userId = u.id || lead.user_id || '';
            const row = [
                csvSafe(lead.response_id || lead.user_id || '-'),
                csvSafe(
                    lead.submitted_at_local ? convertToLocalDateTime(lead.submitted_at_local) : '-'
                ),
                csvSafe(u.full_name || lead.parent_name || '-'),
                csvSafe(u.email || lead.parent_email || '-'),
                csvSafe(u.mobile_number || lead.parent_mobile || '-'),
                csvSafe(displayAudience(lead)),
            ];
            if (showOps) {
                const cName = userId
                    ? (prof as Record<string, { assigned_counselor_name?: string | null }>)[userId]
                          ?.assigned_counselor_name ?? ''
                    : '';
                const summary = userId
                    ? (
                          nts as Record<
                              string,
                              {
                                  recent: Array<{
                                      title?: string;
                                      description?: string | null;
                                      created_at?: string;
                                      actor_name?: string | null;
                                  }>;
                                  count: number;
                              }
                          >
                      )[userId]
                    : undefined;
                const recent = summary?.recent ?? [];
                const block = recent
                    .map((n, idx) => {
                        const raw = n.description ?? '';
                        const body = (
                            /<\/?[a-z][^>]*>/i.test(raw) ? parseHtmlToString(raw) : raw
                        ).trim();
                        return [
                            `${idx + 1}. ${n.title?.trim() || 'Note'} - ${body}`,
                            `   updatedby - ${n.actor_name || ''}`,
                            `   date - ${n.created_at ? convertToLocalDateTime(n.created_at) : ''}`,
                        ].join('\n');
                    })
                    .join('\n\n');
                row.push(
                    csvSafe(lead.lead_status ?? ''),
                    csvSafe(cName),
                    csvSafe(block),
                    csvSafe(summary?.count ?? 0)
                );
            }
            return row.join(',');
        });
        const csv = [[...baseHeaders, ...tail].join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${prefix}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${leads.length} leads`);
    };

    const handleExportAll = async () => {
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
                    lead_status_id: leadStatusId,
                    conversion_status_filter: conversionFilter,
                    sla_filter: slaFilter === ALL_SLA_VALUE ? undefined : (slaFilter as SlaFilter),
                    assigned_counselor_id:
                        counsellorFilter === ALL_COUNSELLORS_VALUE ? undefined : counsellorFilter,
                    source_type: sourceFilter || undefined,
                    page: pageNo,
                    size: 200,
                });
                if (resp?.content?.length) allLeads.push(...resp.content);
                last = resp?.last ?? true;
                pageNo += 1;
                if (pageNo > 200) break;
            }
            await exportLeadsCsv(allLeads, 'recent_leads');
        } catch (err) {
            console.error('Recent leads export failed:', err);
            toast.error('Failed to export recent leads');
        } finally {
            setIsExporting(false);
        }
    };
    // Active filter chips
    const chips: { label: string; onRemove: () => void }[] = [];
    if (appliedSearch)
        chips.push({
            label: `Search: ${appliedSearch}`,
            onRemove: () => {
                setSearchInput('');
                setAppliedSearch('');
            },
        });
    if (audienceId !== ALL_AUDIENCES_VALUE)
        chips.push({
            label: `Audience: ${audienceOptions.find((o) => o.id === audienceId)?.name ?? 'Selected'}`,
            onRemove: () => handleAudienceChange(ALL_AUDIENCES_VALUE),
        });
    if (slaFilter !== ALL_SLA_VALUE)
        chips.push({
            label: `SLA: ${SLA_OPTIONS.find((o) => o.value === slaFilter)?.label ?? slaFilter}`,
            onRemove: () => setSla(ALL_SLA_VALUE),
        });
    if (counsellorFilter !== ALL_COUNSELLORS_VALUE) {
        const cName =
            counsellorOptions.find((c) => c.id === counsellorFilter)?.full_name ?? 'Selected';
        chips.push({
            label: `Counsellor: ${cName}`,
            onRemove: () => setCounsellor(ALL_COUNSELLORS_VALUE),
        });
    }
    if (sourceFilter)
        chips.push({
            label: `Source: ${sourceFilter}`,
            onRemove: () => {
                setPage(0);
                setSourceFilter('');
            },
        });
    if (rangeDays !== DEFAULT_RANGE_DAYS) {
        let label: string;
        if (rangeDays === CUSTOM_DATE_VALUE) {
            label =
                customFrom && customTo ? `Date: ${customFrom} → ${customTo}` : 'Date: custom range';
        } else {
            label = DATE_RANGE_OPTIONS.find((o) => o.value === rangeDays)?.label ?? 'Date range';
        }
        chips.push({
            label,
            onRemove: () => {
                setRangeDays(DEFAULT_RANGE_DAYS);
                setCustomFrom('');
                setCustomTo('');
            },
        });
    }

    return (
        <div className="flex w-full flex-col gap-4">
            {/* Heading */}
            <h1 className="text-2xl font-semibold text-neutral-900">
                {totalElements.toLocaleString()} {totalElements === 1 ? 'Lead' : 'Leads'}
            </h1>

            {/* Toolbar — left filters, right actions (search lives in its own row below) */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {showOps && (
                        <Select value={tierFilter} onValueChange={setTier}>
                            <SelectTrigger className="h-10 w-36">
                                <Flame className="mr-1.5 size-4 text-neutral-400" />
                                <SelectValue placeholder="All tiers" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_TIERS_VALUE}>All tiers</SelectItem>
                                <SelectItem value="HOT">Hot</SelectItem>
                                <SelectItem value="WARM">Warm</SelectItem>
                                <SelectItem value="COLD">Cold</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                    <Select value={leadStatusFilter} onValueChange={setLeadStatus}>
                        <SelectTrigger className="h-10 w-44">
                            <CheckCircle className="mr-1.5 size-4 text-neutral-400" />
                            <SelectValue placeholder="Active leads" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_ACTIVE_VALUE}>Active leads</SelectItem>
                            <SelectItem value={ALL_STATUSES_VALUE}>All statuses</SelectItem>
                            {leadStatusCatalog.map((s) => (
                                <SelectItem key={s.id} value={s.status_key}>
                                    {s.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {showOps && (
                        <Select value={slaFilter} onValueChange={setSla}>
                            <SelectTrigger className="h-10 w-44">
                                <Clock className="mr-1.5 size-4 text-neutral-400" />
                                <SelectValue placeholder="Action status" />
                            </SelectTrigger>
                            <SelectContent>
                                {SLA_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        <SlaOptionLabel label={o.label} helper={o.helper} />
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {showOps && (
                        <CounsellorFilter
                            value={counsellorFilter}
                            onChange={setCounsellor}
                            allValue={ALL_COUNSELLORS_VALUE}
                            options={counsellorOptions}
                            isLoading={counsellorOptionsQuery.isLoading}
                        />
                    )}
                    <Select value={audienceId} onValueChange={handleAudienceChange}>
                        <SelectTrigger className="h-10 w-44">
                            <Megaphone className="mr-1.5 size-4 text-neutral-400" />
                            <SelectValue placeholder="All audiences" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_AUDIENCES_VALUE}>All audiences</SelectItem>
                            {audienceOptions.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                    {opt.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={rangeDays} onValueChange={setDateRange}>
                        <SelectTrigger className="h-10 w-40">
                            <CalendarBlank className="mr-1.5 size-4 text-neutral-400" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DATE_RANGE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {rangeDays === CUSTOM_DATE_VALUE && (
                        <Popover open={customOpen} onOpenChange={setCustomOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-10">
                                    <CalendarBlank className="mr-1.5 size-4 text-neutral-400" />
                                    {customFrom && customTo
                                        ? `${customFrom} → ${customTo}`
                                        : 'Set dates'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-72 space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-neutral-600">From</Label>
                                        <Input
                                            type="date"
                                            value={customFrom}
                                            onChange={(e) => setCustomFrom(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-neutral-600">To</Label>
                                        <Input
                                            type="date"
                                            value={customTo}
                                            onChange={(e) => setCustomTo(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    className="w-full"
                                    onClick={() => setCustomOpen(false)}
                                >
                                    Done
                                </Button>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-10">
                                <Columns className="mr-1.5 size-4" />
                                Manage Column
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-52">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                Columns
                            </p>
                            <div className="space-y-1">
                                {toggleableColumns.map((c) => (
                                    <label
                                        key={c.id}
                                        className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-neutral-700 hover:bg-neutral-50"
                                    >
                                        <Checkbox
                                            checked={!hiddenColumns.has(c.id)}
                                            onCheckedChange={() => toggleColumn(c.id)}
                                        />
                                        {c.label}
                                    </label>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-10"
                        onClick={handleExportAll}
                        disabled={isExporting || !data?.totalElements}
                    >
                        <DownloadSimple className="mr-1.5 size-4" />
                        {isExporting ? 'Exporting…' : 'Export'}
                    </Button>
                </div>
            </div>

            {/* Active filter chips */}
            {chips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    {chips.map((chip, i) => (
                        <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600"
                        >
                            {chip.label}
                            <button
                                type="button"
                                onClick={chip.onRemove}
                                className="text-neutral-400 hover:text-neutral-700"
                                aria-label={`Remove ${chip.label}`}
                            >
                                <X className="size-3" />
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={handleClearFilter}
                        className="px-1 text-xs font-medium text-primary-600 hover:underline"
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* Search + result count — its own row, mirroring the reference layout */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search leads"
                        className="h-10 w-full pl-8"
                        aria-label="Search leads"
                    />
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <span>Showing</span>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(v) => {
                            setPageSize(Number(v));
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="h-8 w-20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZE_OPTIONS.map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                    {n}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span>of {totalElements.toLocaleString()} results</span>
                </div>
            </div>

            {/* Table */}
            <SidebarProvider
                style={{ ['--sidebar-width' as string]: '565px' }}
                defaultOpen={false}
                open={isSidebarOpen}
                onOpenChange={setIsSidebarOpen}
            >
                <div className="min-w-0 flex-1">
                    {error ? (
                        <LeadEmptyState
                            title="Couldn't load leads"
                            description="Something went wrong fetching leads. Try again."
                        />
                    ) : (
                        <LeadTable
                            vms={vms}
                            profiles={leadProfiles}
                            notes={notesByUserId}
                            statuses={leadStatusCatalog}
                            showOps={showOps}
                            showScore={showScore}
                            isLoading={isLoading}
                            actions={actions}
                            onStatusUpdated={handleStatusUpdated}
                            hiddenColumns={hiddenColumns}
                            emptyState={
                                <LeadEmptyState
                                    onClear={isFilterActive ? handleClearFilter : undefined}
                                />
                            }
                        />
                    )}
                </div>
                <StudentSidebar
                    selectedTab="overview"
                    examType="EXAM"
                    isStudentList={false}
                    defaultLeadProfile
                />

                {noteTarget && (
                    <AddLeadNoteDialog
                        open={!!noteTarget}
                        onOpenChange={(o) => !o && setNoteTarget(null)}
                        userId={noteTarget.userId}
                        userName={noteTarget.userName}
                        audienceResponseId={noteTarget.responseId}
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

            {/* Pagination */}
            <LeadPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
    );
};
