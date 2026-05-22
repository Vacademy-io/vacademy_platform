import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { convertToLocalDateTime } from '@/constants/helper';
import { parseHtmlToString } from '@/lib/utils';
import {
    DownloadSimple,
    MagnifyingGlass,
    Funnel,
    X,
    Flame,
    CheckCircle,
    Columns,
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
import { MyPagination } from '@/components/design-system/pagination';
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
import { AddLeadNoteDialog } from '@/components/shared/add-lead-note-dialog';
import { AssignCounselorToLeadDialog } from '@/components/shared/assign-counselor-to-lead-dialog';
import {
    LeadEmptyState,
    LeadTable,
    useUpdateLeadTier,
    recentLeadToVM,
    type LeadActionHandlers,
    type LeadSortKey,
    type LeadSortState,
} from '@/components/shared/leads';

const ALL_AUDIENCES_VALUE = '__ALL__';
const ALL_TIERS_VALUE = '__ALL__';
const ALL_ACTIVE_VALUE = '__ACTIVE__'; // all leads except Converted (default)
const ALL_STATUSES_VALUE = '__ALL_STATUS__'; // every lead regardless of status
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
const RECENT_DEFAULT_DAYS = 30;
const computeDefaultRange = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (RECENT_DEFAULT_DAYS - 1));
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

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const defaultRange = useMemo(() => computeDefaultRange(), []);
    const [fromDate, setFromDate] = useState(defaultRange.from);
    const [toDate, setToDate] = useState(defaultRange.to);
    const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>(defaultRange);
    const [audienceId, setAudienceId] = useState<string>(ALL_AUDIENCES_VALUE);

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

    const [tierFilter, setTierFilter] = useState<string>(ALL_TIERS_VALUE);
    // Unified Lead Status filter — combines pipeline status + conversion state:
    //   ALL_ACTIVE_VALUE   → all leads except Converted (default)
    //   ALL_STATUSES_VALUE → every lead regardless of status
    //   <statusKey>        → only leads currently in that custom status
    const [leadStatusFilter, setLeadStatusFilter] = useState<string>(ALL_ACTIVE_VALUE);

    const leadSettings = useLeadSettings();
    const showOps = !leadSettings.isLoading && leadSettings.enabled;
    const showScore = showOps && leadSettings.showScoreInEnquiryTable;

    // Custom lead-status catalog — drives both the filter dropdown and the
    // editable status chip in the table.
    const { statuses: leadStatusCatalog } = useLeadStatuses();

    // Table UI state
    const [sort, setSort] = useState<LeadSortState>({ key: 'submitted', dir: 'desc' });
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

    const [noteTarget, setNoteTarget] = useState<{ userId: string; userName: string } | null>(null);
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
                { id: 'reachout', label: 'Reach out by' },
                { id: 'followup', label: 'Follow up by' },
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

    // Reset selection whenever the result set changes.
    useEffect(() => {
        setSelectedKeys(new Set());
    }, [data]);

    const invalidateKeys = [['recent-leads'], ['lead-profiles-batch']];
    const updateTier = useUpdateLeadTier({ invalidateKeys });

    const actions: LeadActionHandlers = useMemo(
        () => ({
            onOpenDetails: (vm) => {
                setSelectedStudent(vm.toStudent());
                setIsSidebarOpen(true);
            },
            onAddNote: (userId, userName) => setNoteTarget({ userId, userName }),
            onAssignCounsellor: (userId, userName) => setCounsellorTarget({ userId, userName }),
            onSetTier: (userId, _userName, tier) => updateTier.mutate({ userId, tier }),
        }),
        [setSelectedStudent, updateTier]
    );

    const handleStatusUpdated = () => queryClient.invalidateQueries({ queryKey: ['recent-leads'] });

    // Selection
    const onToggleKey = (key: string) =>
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    const onToggleAll = () =>
        setSelectedKeys((prev) => {
            const allSelected = vms.length > 0 && vms.every((v) => prev.has(v.key));
            return allSelected ? new Set() : new Set(vms.map((v) => v.key));
        });

    const handleSortChange = (key: LeadSortKey) =>
        setSort((prev) =>
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: key === 'name' ? 'asc' : 'desc' }
        );

    const toggleColumn = (id: string) =>
        setHiddenColumns((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    // Filters
    const handleClearFilter = () => {
        setFromDate('');
        setToDate('');
        setAudienceId(ALL_AUDIENCES_VALUE);
        setSearchInput('');
        setAppliedSearch('');
        setTierFilter(ALL_TIERS_VALUE);
        setLeadStatusFilter(ALL_ACTIVE_VALUE);
        setPage(0);
        setAppliedRange({ from: '', to: '' });
    };
    const setTier = (value: string) => {
        setPage(0);
        setTierFilter(value);
    };
    const setLeadStatus = (value: string) => {
        setPage(0);
        setLeadStatusFilter(value);
    };
    const handleApplyDate = () => {
        setPage(0);
        setAppliedRange({ from: fromDate, to: toDate });
    };
    const handleAudienceChange = (value: string) => {
        setPage(0);
        setAudienceId(value);
    };

    const isFilterActive =
        !!appliedRange.from ||
        !!appliedRange.to ||
        audienceId !== ALL_AUDIENCES_VALUE ||
        !!appliedSearch ||
        tierFilter !== ALL_TIERS_VALUE ||
        leadStatusFilter !== ALL_ACTIVE_VALUE;
    const moreFiltersActive =
        audienceId !== ALL_AUDIENCES_VALUE || !!appliedRange.from || !!appliedRange.to;

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
    const handleExportSelected = async () => {
        const leads = (data?.content ?? []).filter((l) => selectedKeys.has(recentLeadToVM(l).key));
        await exportLeadsCsv(leads, 'recent_leads_selected');
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
    if (appliedRange.from || appliedRange.to)
        chips.push({
            label: `Date: ${appliedRange.from || '…'} → ${appliedRange.to || '…'}`,
            onRemove: () => {
                setFromDate('');
                setToDate('');
                setAppliedRange({ from: '', to: '' });
            },
        });

    return (
        <div className="flex w-full flex-col gap-4">
            {/* Heading */}
            <h1 className="text-2xl font-semibold text-neutral-900">
                {totalElements.toLocaleString()} {totalElements === 1 ? 'Lead' : 'Leads'}
            </h1>

            {/* Toolbar — left filters, right actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                    <div className="relative min-w-64 flex-1">
                        <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                        <Input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search name, email or phone"
                            className="h-10 w-full pl-8"
                            aria-label="Search leads"
                        />
                    </div>
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
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-10">
                                <Funnel className="mr-1.5 size-4" />
                                More filters
                                {moreFiltersActive && (
                                    <span className="ml-1.5 size-1.5 rounded-full bg-primary-500" />
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-72 space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-neutral-600">Audience</Label>
                                <Select value={audienceId} onValueChange={handleAudienceChange}>
                                    <SelectTrigger className="h-9 w-full">
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
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-neutral-600">From</Label>
                                    <Input
                                        type="date"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-neutral-600">To</Label>
                                    <Input
                                        type="date"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                            </div>
                            <Button size="sm" className="w-full" onClick={handleApplyDate}>
                                Apply dates
                            </Button>
                        </PopoverContent>
                    </Popover>
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

            {/* Bulk selection bar */}
            {selectedKeys.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5">
                    <span className="text-sm font-semibold text-primary-700">
                        {selectedKeys.size} selected
                    </span>
                    <Button size="sm" variant="outline" onClick={handleExportSelected}>
                        <DownloadSimple className="mr-1.5 size-4" />
                        Export selected
                    </Button>
                    <button
                        type="button"
                        onClick={() => setSelectedKeys(new Set())}
                        className="ml-auto text-xs font-medium text-primary-700 hover:underline"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Showing N of total */}
            <div className="flex items-center justify-end gap-2 text-sm text-neutral-500">
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
                            selectedKeys={selectedKeys}
                            onToggleKey={onToggleKey}
                            onToggleAll={onToggleAll}
                            sort={sort}
                            onSortChange={handleSortChange}
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
            {totalPages > 1 && (
                <MyPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            )}
        </div>
    );
};
