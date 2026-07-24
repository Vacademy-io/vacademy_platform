import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { convertToLocalDateTime } from '@/constants/helper';
import { cn, parseHtmlToString } from '@/lib/utils';
import {
    DownloadSimple,
    MagnifyingGlass,
    X,
    Flame,
    CheckCircle,
    Clock,
    Megaphone,
    CalendarBlank,
} from '@phosphor-icons/react';
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
import {
    fetchLeadJourneyBatch,
    formatJourneyForExport,
    type JourneyEvent,
} from '@/components/shared/leads/lead-journey-export';
import { useLeadStatuses } from '@/hooks/use-lead-statuses';
import { useLeadCounsellorOptions } from '@/hooks/use-lead-counsellor-options';
import { CounsellorFilter } from '@/components/shared/leads/counsellor-filter';
import { MultiSelectFilter } from '@/components/shared/leads/multi-select-filter';
import {
    ManageColumnsPopover,
    useLeadColumnPrefs,
    buildLeadColumnToggles,
} from '@/components/shared/leads';
import {
    ExportColumnPickerDialog,
    type ExportColumnOption,
} from '@/components/shared/leads/export-column-picker-dialog';
import { CustomFieldMultiSelectFilter } from '@/components/shared/leads/custom-field-multi-select-filter';
import { ManageListFiltersLink } from '@/components/shared/leads/manage-list-filters-link';
import { CustomFieldRangeFilter } from '@/components/shared/leads/custom-field-range-filter';
import {
    decodeSelectionToEntries,
    filterEntryValueLabel,
    isRangeFieldType,
    removeEntryFromSelection,
} from '@/components/shared/leads/custom-field-filter-encoding';
import { useLeadFilterCustomFields } from '@/components/shared/leads/use-lead-filter-custom-fields';
import { AddLeadNoteDialog } from '@/components/shared/add-lead-note-dialog';
import { AssignCounselorToLeadDialog } from '@/components/shared/assign-counselor-to-lead-dialog';
import {
    BulkAssignCounsellorDialog,
    type BulkAssignMode,
} from '@/components/shared/leads/bulk-assign-counsellor-dialog';
import { MyDropdown } from '@/components/design-system/dropdown';
import type { LeadCardVM } from '@/components/shared/leads/lead-view-model';
import { MyButton } from '@/components/design-system/button';
import { isAdminForInstitute } from '@/lib/auth/roleUtils';
import { DeleteLeadsDialog } from '@/components/shared/leads/delete-leads-dialog';
import { restoreAudienceLeads } from '@/routes/audience-manager/list/-services/delete-audience-lead';
import {
    ArrowCounterClockwise,
    CaretDown,
    Phone,
    Trash,
    UserMinus,
    UserPlus,
} from '@phosphor-icons/react';
import {
    LeadEmptyState,
    LeadTable,
    LeadPagination,
    useUpdateLeadTier,
    usePlaceCall,
    usePlaceAiCall,
    useAiCallButtonEnabled,
    AiCallDialog,
    type AiCallDialogTarget,
    recentLeadToVM,
    type LeadActionHandlers,
    type LeadSortKey,
    type LeadSortDirection,
} from '@/components/shared/leads';

import {
    ALL_AUDIENCES_VALUE,
    ALL_TIERS_VALUE,
    ALL_ACTIVE_VALUE,
    ALL_STATUSES_VALUE,
    ALL_CONVERTED_VALUE,
    ALL_SLA_VALUE,
    ALL_COUNSELLORS_VALUE,
    UNASSIGNED_COUNSELLOR_VALUE,
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
    const [sortBy, setSortBy] = useState<LeadSortKey>('SUBMITTED_AT');
    const [sortDirection, setSortDirection] = useState<LeadSortDirection>('DESC');
    const handleSortChange = (nextSortBy: LeadSortKey, nextSortDirection: LeadSortDirection) => {
        setPage(0);
        setSortBy(nextSortBy);
        setSortDirection(nextSortDirection);
    };
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
    // Audience multi-select — campaign ids. Empty = all campaigns.
    const [audienceFilters, setAudienceFilters] = useState<string[]>(() =>
        urlSearch.audience
            ? urlSearch.audience
                  .split(',')
                  .filter((v) => v && v !== ALL_AUDIENCES_VALUE)
            : []
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

    // Multi-select arrays seeded from URL (comma-separated strings). Empty = no filter.
    const [tierFilters, setTierFilters] = useState<string[]>(() =>
        urlSearch.tier ? urlSearch.tier.split(',') : []
    );
    // Lead-status multi-select. Empty = all leads. ALL_ACTIVE / ALL_CONVERTED are
    // exclusive: handleLeadStatusChange enforces mutual exclusion with custom statuses.
    const [leadStatusFilters, setLeadStatusFilters] = useState<string[]>(() =>
        urlSearch.status ? urlSearch.status.split(',') : []
    );
    // SLA-state multi-select.
    const [slaFilters, setSlaFilters] = useState<string[]>(() =>
        urlSearch.sla ? urlSearch.sla.split(',') : []
    );
    // Counsellor multi-select — userIds (may include UNASSIGNED_COUNSELLOR_VALUE).
    const [counsellorFilters, setCounsellorFilters] = useState<string[]>(() =>
        urlSearch.counsellor ? urlSearch.counsellor.split(',') : []
    );
    // Source-type filter — URL-only for now (no dropdown); drill-through links
    // from the Reports source breakdown set it. Empty string = all sources.
    const [sourceFilter, setSourceFilter] = useState<string>(urlSearch.source ?? '');

    // Call-history filter — has this lead been call-attempted (AI or manual), and
    // how many times. Single-select; '' = no filter.
    const [callHistoryFilter, setCallHistoryFilter] = useState<string>(urlSearch.called ?? '');

    // Custom-field filters — keyed by custom_field_id, each holding the selected
    // values (multi-select). Only fields the admin enabled in Lead Settings
    // render a control; an empty map means none are active.
    const { fields: filterCustomFields } = useLeadFilterCustomFields(instituteId);
    const [customFieldFilters, setCustomFieldFilters] = useState<Record<string, string[]>>({});
    const setCustomFieldFilter = (fieldId: string, values: string[]) => {
        setPage(0);
        setCustomFieldFilters((prev) => {
            const next = { ...prev };
            if (values.length === 0) delete next[fieldId];
            else next[fieldId] = values;
            return next;
        });
    };
    // Serialized {field_id, operator, values} payload + a stable cache key
    // (order-independent). Sentinel selections (contains / empty / ranges)
    // decode into their operator entries; plain values stay an IN entry.
    const customFieldFiltersPayload = useMemo(
        () =>
            Object.entries(customFieldFilters)
                .filter(([, vals]) => vals.length > 0)
                .flatMap(([fieldId, values]) => decodeSelectionToEntries(fieldId, values)),
        [customFieldFilters]
    );
    const customFieldFiltersKey = useMemo(
        () =>
            customFieldFiltersPayload
                .map((f) => `${f.field_id}:${f.operator ?? 'IN'}=${[...f.values].sort().join(',')}`)
                .sort()
                .join('|'),
        [customFieldFiltersPayload]
    );

    // Write the applied filters back to the URL (replace, not push — filter
    // tweaks shouldn't pollute browser history). Arrays are serialised as
    // comma-separated strings; empty arrays are omitted so the bare URL stays clean.
    useEffect(() => {
        void navigate({
            search: {
                status: leadStatusFilters.length > 0 ? leadStatusFilters.join(',') : undefined,
                tier: tierFilters.length > 0 ? tierFilters.join(',') : undefined,
                sla: slaFilters.length > 0 ? slaFilters.join(',') : undefined,
                counsellor:
                    counsellorFilters.length > 0 ? counsellorFilters.join(',') : undefined,
                audience: audienceFilters.length > 0 ? audienceFilters.join(',') : undefined,
                search: appliedSearch || undefined,
                range: rangeDays === DEFAULT_RANGE_DAYS ? undefined : rangeDays,
                from: rangeDays === CUSTOM_DATE_VALUE && customFrom ? customFrom : undefined,
                to: rangeDays === CUSTOM_DATE_VALUE && customTo ? customTo : undefined,
                source: sourceFilter || undefined,
                called: callHistoryFilter || undefined,
            },
            replace: true,
        });
    }, [
        navigate,
        leadStatusFilters,
        tierFilters,
        slaFilters,
        counsellorFilters,
        audienceFilters,
        appliedSearch,
        rangeDays,
        customFrom,
        customTo,
        sourceFilter,
        callHistoryFilter,
    ]);
    // Filter options — hierarchy scoped: a manager sees themselves + their
    // counsellor reports; pure admins get the institute-wide roster.
    const { options: counsellorOptions, isLoading: counsellorOptionsLoading } =
        useLeadCounsellorOptions();
    // Assignment TARGETS for the bulk-assign dialog: an ADMIN who also holds
    // the COUNSELLOR role filters by their hierarchy above, but may still
    // assign leads to any counsellor of the institute.
    const { options: assignableCounsellorOptions } = useLeadCounsellorOptions({
        assignable: true,
    });

    const leadSettings = useLeadSettings();
    const showOps = !leadSettings.isLoading && leadSettings.enabled;
    const showScore = showOps && leadSettings.showScoreInEnquiryTable;

    // Custom lead-status catalog — drives both the filter dropdown and the
    // editable status chip in the table.
    const { statuses: leadStatusCatalog } = useLeadStatuses();

    // Table UI state — column show/hide is persisted per user (localStorage) so
    // the "Manage Column" choice survives reloads and navigation.
    const { hiddenColumns, toggleColumn, resetColumns } = useLeadColumnPrefs(
        'crm-lead-columns:recent-leads'
    );

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
    const toggleableColumns = useMemo(
        () => buildLeadColumnToggles(showOps, showScore),
        [showOps, showScore]
    );

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

    // Translate the multi-select status filter into the two backend params.
    const specialStatuses = new Set([ALL_STATUSES_VALUE, ALL_ACTIVE_VALUE, ALL_CONVERTED_VALUE]);
    const customStatusKeys = leadStatusFilters.filter((v) => !specialStatuses.has(v));
    const leadStatusId = customStatusKeys.length > 0 ? customStatusKeys.join(',') : undefined;
    const conversionFilter: 'EXCLUDE_CONVERTED' | 'ALL' | 'ONLY_CONVERTED' =
        leadStatusFilters.includes(ALL_ACTIVE_VALUE)
            ? 'EXCLUDE_CONVERTED'
            : leadStatusFilters.includes(ALL_CONVERTED_VALUE)
              ? 'ONLY_CONVERTED'
              : 'ALL';
    // "Deleted leads" view — deleted leads are hidden everywhere by default; this is the one
    // place they can be seen, and the only way to restore one from the UI.
    const [showDeleted, setShowDeleted] = useState(false);
    // Undefined (not EXCLUDE_DELETED) when off, so the backend's own default applies and the
    // param stays absent from the normal request.
    const audienceStatusFilter: 'ONLY_DELETED' | undefined = showDeleted ? 'ONLY_DELETED' : undefined;

    // Restore needs no confirm dialog: unlike delete it's additive, and the rows are already
    // sitting in a view the admin had to opt into.
    const restoreMutation = useMutation({
        mutationFn: () =>
            restoreAudienceLeads({
                responseIds: Array.from(selectedLeads.keys()),
                instituteId: instituteId ?? '',
            }),
        onSuccess: (restored: number) => {
            toast.success(restored === 1 ? 'Lead restored' : `${restored} leads restored`);
            setSelectedLeads(new Map());
            handleStatusUpdated();
        },
        onError: (error: unknown) => {
            const message =
                (error as { response?: { data?: { ex?: string } } })?.response?.data?.ex ??
                'Failed to restore. Please try again.';
            toast.error(message);
        },
    });
    const nonUnassignedCounsellorIds = counsellorFilters.filter(
        (v) => v !== UNASSIGNED_COUNSELLOR_VALUE
    );
    const onlyUnassigned =
        counsellorFilters.includes(UNASSIGNED_COUNSELLOR_VALUE) &&
        nonUnassignedCounsellorIds.length === 0;

    const { data, isLoading, error } = useQuery({
        queryKey: [
            'recent-leads',
            instituteId,
            appliedRange.from,
            appliedRange.to,
            audienceFilters.join(','),
            appliedSearch,
            tierFilters.join(','),
            leadStatusFilters.join(','),
            leadStatusId,
            conversionFilter,
            audienceStatusFilter,
            slaFilters.join(','),
            counsellorFilters.join(','),
            sourceFilter,
            callHistoryFilter,
            customFieldFiltersKey,
            page,
            pageSize,
            sortBy,
            sortDirection,
        ],
        queryFn: () =>
            fetchRecentLeads({
                institute_id: instituteId ?? '',
                audience_id:
                    audienceFilters.length === 1 ? audienceFilters[0] : undefined,
                submitted_from_local: startOfDayIso(appliedRange.from),
                submitted_to_local: endOfDayIso(appliedRange.to),
                search_query: appliedSearch || undefined,
                lead_tier: tierFilters.length > 0 ? tierFilters.join(',') : undefined,
                lead_status_id: leadStatusId,
                conversion_status_filter: conversionFilter,
                audience_status_filter: audienceStatusFilter,
                sla_filter:
                    slaFilters.length > 0 ? (slaFilters.join(',') as SlaFilter) : undefined,
                assigned_counselor_id:
                    nonUnassignedCounsellorIds.length > 0
                        ? nonUnassignedCounsellorIds.join(',')
                        : undefined,
                is_unassigned: onlyUnassigned ? true : undefined,
                source_type: sourceFilter || undefined,
                call_history_filter: callHistoryFilter || undefined,
                custom_field_filters: customFieldFiltersPayload.length
                    ? customFieldFiltersPayload
                    : undefined,
                sort_by: sortBy,
                sort_direction: sortDirection,
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
    const { profiles: leadProfiles } = useLeadProfiles(userIds, showOps, instituteId);
    const { notesByUserId } = useLatestNotesBatch(userIds, showOps);

    const invalidateKeys = [['recent-leads'], ['lead-profiles-batch']];
    const updateTier = useUpdateLeadTier({ invalidateKeys });
    const placeCall = usePlaceCall({ invalidateKeys });
    const placeAiCall = usePlaceAiCall({ invalidateKeys });
    // The robot "AI call" button only shows when an admin has turned it on in
    // Settings → AI Calling. Automated AI workflows are unaffected by this.
    const showAiButton = useAiCallButtonEnabled();
    // Per-row AI call opens a chooser (which agent speaks) instead of silently
    // dialing with the institute default.
    const [aiCallTarget, setAiCallTarget] = useState<AiCallDialogTarget | null>(null);

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
            onAiCallLead: showAiButton
                ? (vm) => {
                      if (!vm.responseId) return;
                      setAiCallTarget({
                          responseId: vm.responseId,
                          userId: vm.userId ?? undefined,
                          leadName: vm.name,
                      });
                  }
                : undefined,
        }),
        [setSelectedStudent, updateTier, placeCall, showAiButton]
    );

    // The backend mirrors a per-response status change onto the user's profile
    // conversion_status, so the side-view agrees. Invalidate the profile/batch caches too
    // (not just the list) or the side-view could still serve a stale cached profile.
    const handleStatusUpdated = () => {
        queryClient.invalidateQueries({ queryKey: ['recent-leads'] });
        queryClient.invalidateQueries({ queryKey: ['user-lead-profile'] });
        queryClient.invalidateQueries({ queryKey: ['lead-profiles-batch'] });
    };

    // ── Bulk assign / remove counsellor (multi-select, every view) ──
    // Keyed by RESPONSE id, not user id: a row is one campaign response and the same person
    // can hold several, so keying by user collapsed their rows into one checkbox. The value
    // carries the userId too, because the assign actions operate per person.
    const [selectedLeads, setSelectedLeads] = useState<
        Map<string, { userId: string; responseId: string; name: string }>
    >(
        new Map()
    );
    const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const canDeleteLeads = isAdminForInstitute(instituteId);
    // Which flow the "Bulk actions" menu opened: assign (round-robin default)
    // or unassign (REMOVE).
    const [bulkActionMode, setBulkActionMode] = useState<BulkAssignMode>('ROUND_ROBIN');

    // Selection works in EVERY view (assign, reassign AND bulk-remove need
    // assigned leads too — it was previously Unassigned-only, which made the
    // dialog's Remove mode unreachable). Drop it when the counsellor filter
    // changes so stale ids can't leak into an assign.
    useEffect(() => {
        setSelectedLeads(new Map());
    }, [counsellorFilters]);

    const toggleLeadRow = (responseId: string, vm: LeadCardVM) =>
        setSelectedLeads((prev) => {
            const next = new Map(prev);
            if (next.has(responseId)) next.delete(responseId);
            else if (vm.userId) next.set(responseId, { userId: vm.userId, responseId, name: vm.name });
            return next;
        });

    const toggleAllLeads = (checked: boolean, selectableVms: LeadCardVM[]) =>
        setSelectedLeads((prev) => {
            const next = new Map(prev);
            selectableVms.forEach((v) => {
                if (!v.userId || !v.responseId) return;
                if (checked)
                    next.set(v.responseId, { userId: v.userId, responseId: v.responseId, name: v.name });
                else next.delete(v.responseId);
            });
            return next;
        });

    const handleBulkAssignSuccess = () => {
        setSelectedLeads(new Map());
        handleStatusUpdated();
    };

    // Select every lead matching the current filter (across all pages) — fetches
    // all matching ids in one call, mirroring the paginated query's params.
    const [selectAllLoading, setSelectAllLoading] = useState(false);
    const selectAllAcrossPages = async () => {
        if (!totalElements) return;
        try {
            setSelectAllLoading(true);
            const res = await fetchRecentLeads({
                institute_id: instituteId ?? '',
                audience_id:
                    audienceFilters.length === 1 ? audienceFilters[0] : undefined,
                submitted_from_local: startOfDayIso(appliedRange.from),
                submitted_to_local: endOfDayIso(appliedRange.to),
                search_query: appliedSearch || undefined,
                lead_tier: tierFilters.length > 0 ? tierFilters.join(',') : undefined,
                lead_status_id: leadStatusId,
                conversion_status_filter: conversionFilter,
                audience_status_filter: audienceStatusFilter,
                sla_filter:
                    slaFilters.length > 0 ? (slaFilters.join(',') as SlaFilter) : undefined,
                assigned_counselor_id:
                    nonUnassignedCounsellorIds.length > 0
                        ? nonUnassignedCounsellorIds.join(',')
                        : undefined,
                is_unassigned: onlyUnassigned ? true : undefined,
                source_type: sourceFilter || undefined,
                call_history_filter: callHistoryFilter || undefined,
                custom_field_filters: customFieldFiltersPayload.length
                    ? customFieldFiltersPayload
                    : undefined,
                page: 0,
                size: totalElements,
            });
            const map = new Map<string, { userId: string; responseId: string; name: string }>();
            (res.content ?? []).forEach((lead) => {
                const uid = lead.user?.id || lead.user_id;
                // Keyed by response id to match the per-row selection — a person with several
                // responses is several selected rows, not one.
                if (!uid || !lead.response_id) return;
                map.set(lead.response_id, {
                    userId: uid,
                    responseId: lead.response_id,
                    name: lead.user?.full_name || lead.parent_name || uid,
                });
            });
            setSelectedLeads(map);
        } catch {
            toast.error('Failed to select all leads');
        } finally {
            setSelectAllLoading(false);
        }
    };

    // Filters
    const handleClearFilter = () => {
        setAudienceFilters([]);
        setSearchInput('');
        setAppliedSearch('');
        setTierFilters([]);
        setLeadStatusFilters([]);
        setSlaFilters([]);
        setCounsellorFilters([]);
        setSourceFilter('');
        setCallHistoryFilter('');
        setCustomFieldFilters({});
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
    const setCounsellor = (values: string[]) => {
        setPage(0);
        setCounsellorFilters(values);
    };
    const setTier = (values: string[]) => {
        setPage(0);
        setTierFilters(values);
    };
    const handleLeadStatusChange = (newValues: string[]) => {
        setPage(0);
        const justAddedActive =
            newValues.includes(ALL_ACTIVE_VALUE) && !leadStatusFilters.includes(ALL_ACTIVE_VALUE);
        const justAddedConverted =
            newValues.includes(ALL_CONVERTED_VALUE) &&
            !leadStatusFilters.includes(ALL_CONVERTED_VALUE);
        if (justAddedActive) {
            setLeadStatusFilters([ALL_ACTIVE_VALUE]);
        } else if (justAddedConverted) {
            setLeadStatusFilters([ALL_CONVERTED_VALUE]);
        } else {
            setLeadStatusFilters(
                newValues.filter((v) => v !== ALL_ACTIVE_VALUE && v !== ALL_CONVERTED_VALUE)
            );
        }
    };
    const setSla = (values: string[]) => {
        setPage(0);
        setSlaFilters(values);
    };
    const handleAudienceChange = (values: string[]) => {
        setPage(0);
        setAudienceFilters(values);
    };

    const isFilterActive =
        rangeDays !== DEFAULT_RANGE_DAYS ||
        audienceFilters.length > 0 ||
        !!appliedSearch ||
        tierFilters.length > 0 ||
        leadStatusFilters.length > 0 ||
        slaFilters.length > 0 ||
        counsellorFilters.length > 0 ||
        !!sourceFilter ||
        !!callHistoryFilter ||
        customFieldFiltersPayload.length > 0;

    // CSV export (shared by "Export" + "Export selected")
    const [isExporting, setIsExporting] = useState(false);
    const [exportPickerOpen, setExportPickerOpen] = useState(false);
    const [selectedExportCols, setSelectedExportCols] = useState<Set<string>>(new Set());

    const exportColumnOptions = useMemo<ExportColumnOption[]>(() => {
        const cols: ExportColumnOption[] = [
            { key: 'lead_id', label: 'Lead ID' },
            { key: 'submitted_at', label: 'Submitted At' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'audience', label: 'Audience' },
        ];
        if (showOps) {
            cols.push(
                { key: 'lead_status', label: 'Lead Status' },
                { key: 'counsellor', label: 'Counsellor' },
                { key: 'activity_notes', label: 'Activity & Notes' },
                { key: 'notes_count', label: 'Notes Count' },
                { key: 'lead_journey', label: 'Lead Journey (disposition & notes)' }
            );
        }
        return cols;
    }, [showOps]);
    const exportLeadsCsv = async (leads: RecentLeadDetail[], prefix: string) => {
        if (leads.length === 0) {
            toast.info('No leads to export');
            return;
        }
        const ids = Array.from(
            new Set(leads.map((l) => l.user?.id || l.user_id || '').filter(Boolean))
        ) as string[];
        const needsOps =
            showOps &&
            (selectedExportCols.has('lead_status') ||
                selectedExportCols.has('counsellor') ||
                selectedExportCols.has('activity_notes') ||
                selectedExportCols.has('notes_count') ||
                selectedExportCols.has('lead_journey'));
        const [prof, nts, jny] = await Promise.all([
            needsOps ? fetchBatchProfiles(ids, instituteId ?? '') : Promise.resolve({}),
            needsOps ? fetchLatestNotesBatch(ids) : Promise.resolve({}),
            needsOps ? fetchLeadJourneyBatch(ids) : Promise.resolve({}),
        ]);
        const baseHeaders: string[] = [];
        if (selectedExportCols.has('lead_id')) baseHeaders.push('Lead ID');
        if (selectedExportCols.has('submitted_at')) baseHeaders.push('Submitted At');
        if (selectedExportCols.has('name')) baseHeaders.push('Name');
        if (selectedExportCols.has('email')) baseHeaders.push('Email');
        if (selectedExportCols.has('mobile')) baseHeaders.push('Mobile');
        if (selectedExportCols.has('audience')) baseHeaders.push('Audience');
        const tail: string[] = [];
        if (showOps) {
            if (selectedExportCols.has('lead_status')) tail.push('Lead Status');
            if (selectedExportCols.has('counsellor')) tail.push('Counsellor');
            if (selectedExportCols.has('activity_notes')) tail.push('Activity & Notes');
            if (selectedExportCols.has('notes_count')) tail.push('Notes Count');
            if (selectedExportCols.has('lead_journey'))
                tail.push('Lead journey (disposition & notes)');
        }
        const rows = leads.map((lead) => {
            const u = lead.user ?? {};
            const userId = u.id || lead.user_id || '';
            const row: string[] = [];
            if (selectedExportCols.has('lead_id'))
                row.push(csvSafe(lead.response_id || lead.user_id || '-'));
            if (selectedExportCols.has('submitted_at'))
                row.push(
                    csvSafe(
                        lead.submitted_at_local
                            ? convertToLocalDateTime(lead.submitted_at_local)
                            : '-'
                    )
                );
            if (selectedExportCols.has('name'))
                row.push(csvSafe(u.full_name || lead.parent_name || '-'));
            if (selectedExportCols.has('email'))
                row.push(csvSafe(u.email || lead.parent_email || '-'));
            if (selectedExportCols.has('mobile'))
                row.push(csvSafe(u.mobile_number || lead.parent_mobile || '-'));
            if (selectedExportCols.has('audience')) row.push(csvSafe(displayAudience(lead)));
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
                if (selectedExportCols.has('lead_status')) row.push(csvSafe(lead.lead_status ?? ''));
                if (selectedExportCols.has('counsellor')) row.push(csvSafe(cName));
                if (selectedExportCols.has('activity_notes')) row.push(csvSafe(block));
                if (selectedExportCols.has('notes_count')) row.push(csvSafe(summary?.count ?? 0));
                if (selectedExportCols.has('lead_journey'))
                    row.push(
                        csvSafe(
                            formatJourneyForExport(
                                userId ? (jny as Record<string, JourneyEvent[]>)[userId] : undefined
                            )
                        )
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
                    audience_id:
                        audienceFilters.length === 1 ? audienceFilters[0] : undefined,
                    submitted_from_local: startOfDayIso(appliedRange.from),
                    submitted_to_local: endOfDayIso(appliedRange.to),
                    search_query: appliedSearch || undefined,
                    lead_tier: tierFilters.length > 0 ? tierFilters.join(',') : undefined,
                    lead_status_id: leadStatusId,
                    conversion_status_filter: conversionFilter,
                    audience_status_filter: audienceStatusFilter,
                    sla_filter:
                        slaFilters.length > 0 ? (slaFilters.join(',') as SlaFilter) : undefined,
                    assigned_counselor_id:
                        nonUnassignedCounsellorIds.length > 0
                            ? nonUnassignedCounsellorIds.join(',')
                            : undefined,
                    is_unassigned: onlyUnassigned ? true : undefined,
                    source_type: sourceFilter || undefined,
                    call_history_filter: callHistoryFilter || undefined,
                    custom_field_filters: customFieldFiltersPayload.length
                        ? customFieldFiltersPayload
                        : undefined,
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
    if (audienceFilters.length > 0) {
        const names = audienceFilters.map(
            (id) => audienceOptions.find((o) => o.id === id)?.name ?? 'Selected'
        );
        chips.push({
            label: `Audience: ${names.join(', ')}`,
            onRemove: () => handleAudienceChange([]),
        });
    }
    if (tierFilters.length > 0)
        chips.push({
            label: `Tier: ${tierFilters.join(', ')}`,
            onRemove: () => setTierFilters([]),
        });
    if (leadStatusFilters.length > 0) {
        const statusLabels = leadStatusFilters.map((v) => {
            if (v === ALL_ACTIVE_VALUE) return 'Active';
            if (v === ALL_CONVERTED_VALUE) return 'Converted';
            return leadStatusCatalog.find((s) => s.status_key === v)?.label ?? v;
        });
        chips.push({
            label: `Status: ${statusLabels.join(', ')}`,
            onRemove: () => setLeadStatusFilters([]),
        });
    }
    if (slaFilters.length > 0)
        chips.push({
            label: `SLA: ${slaFilters.map((v) => SLA_OPTIONS.find((o) => o.value === v)?.label ?? v).join(', ')}`,
            onRemove: () => setSlaFilters([]),
        });
    if (counsellorFilters.length > 0) {
        const cLabels = counsellorFilters.map((id) =>
            id === UNASSIGNED_COUNSELLOR_VALUE
                ? 'Unassigned'
                : (counsellorOptions.find((c) => c.id === id)?.full_name ?? 'Selected')
        );
        chips.push({
            label: `Counsellor: ${cLabels.join(', ')}`,
            onRemove: () => setCounsellorFilters([]),
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
    customFieldFiltersPayload.forEach((f) => {
        const fieldName =
            filterCustomFields.find((cf) => cf.customFieldId === f.field_id)?.fieldName ?? 'Field';
        chips.push({
            label: `${fieldName}: ${filterEntryValueLabel(f)}`,
            // Remove only this entry's backing values — one field can carry
            // several chips (values + contains + empty) at once.
            onRemove: () =>
                setCustomFieldFilter(
                    f.field_id,
                    removeEntryFromSelection(customFieldFilters[f.field_id] ?? [], f)
                ),
        });
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
                        <MultiSelectFilter
                            label="All tiers"
                            icon={<Flame className="size-4 shrink-0 text-neutral-400" />}
                            options={[
                                { value: 'HOT', label: 'Hot' },
                                { value: 'WARM', label: 'Warm' },
                                { value: 'COLD', label: 'Cold' },
                            ]}
                            selected={tierFilters}
                            onChange={setTier}
                            widthClass="w-36"
                        />
                    )}
                    <MultiSelectFilter
                        label="All leads"
                        icon={<CheckCircle className="size-4 shrink-0 text-neutral-400" />}
                        options={[
                            { value: ALL_ACTIVE_VALUE, label: 'Active (not enrolled)' },
                            { value: ALL_CONVERTED_VALUE, label: 'Enrolled / Converted' },
                            ...leadStatusCatalog.map((s) => ({
                                value: s.status_key,
                                label: s.label,
                            })),
                        ]}
                        selected={leadStatusFilters}
                        onChange={handleLeadStatusChange}
                        widthClass="w-44"
                    />
                    {showOps && (
                        <MultiSelectFilter
                            label="All SLA states"
                            icon={<Clock className="size-4 shrink-0 text-neutral-400" />}
                            options={SLA_OPTIONS.filter((o) => o.value !== ALL_SLA_VALUE).map(
                                (o) => ({ value: o.value, label: o.label })
                            )}
                            selected={slaFilters}
                            onChange={setSla}
                            widthClass="w-44"
                        />
                    )}
                    {showOps && (
                        <CounsellorFilter
                            values={counsellorFilters}
                            onChange={setCounsellor}
                            unassignedValue={UNASSIGNED_COUNSELLOR_VALUE}
                            options={counsellorOptions}
                            isLoading={counsellorOptionsLoading}
                        />
                    )}
                    <MultiSelectFilter
                        label="All audiences"
                        icon={<Megaphone className="size-4 shrink-0 text-neutral-400" />}
                        options={audienceOptions.map((opt) => ({
                            value: opt.id,
                            label: opt.name,
                        }))}
                        selected={audienceFilters}
                        onChange={handleAudienceChange}
                        widthClass="w-44"
                    />
                    <Select
                        value={callHistoryFilter || 'ANY'}
                        onValueChange={(v) => {
                            setCallHistoryFilter(v === 'ANY' ? '' : v);
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="h-10 w-44">
                            <Phone className="mr-1.5 size-4 shrink-0 text-neutral-400" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ANY">Call history</SelectItem>
                            <SelectItem value="NOT_CALLED">Not called</SelectItem>
                            <SelectItem value="CALLED">Called (any)</SelectItem>
                            <SelectItem value="CALLED_ONCE">Called once</SelectItem>
                            <SelectItem value="CALLED_TWICE_PLUS">Called 2+ times</SelectItem>
                            <SelectItem value="AI_CALLED">AI called</SelectItem>
                            <SelectItem value="MANUAL_CALLED">Manually called</SelectItem>
                        </SelectContent>
                    </Select>
                    {filterCustomFields.map((f) =>
                        isRangeFieldType(f.fieldType) ? (
                            <CustomFieldRangeFilter
                                key={f.customFieldId}
                                fieldId={f.customFieldId}
                                fieldName={f.fieldName}
                                fieldType={f.fieldType}
                                selected={customFieldFilters[f.customFieldId] ?? []}
                                onChange={(vals) => setCustomFieldFilter(f.customFieldId, vals)}
                            />
                        ) : (
                            <CustomFieldMultiSelectFilter
                                key={f.customFieldId}
                                instituteId={instituteId ?? ''}
                                fieldId={f.customFieldId}
                                fieldName={f.fieldName}
                                selected={customFieldFilters[f.customFieldId] ?? []}
                                onChange={(vals) => setCustomFieldFilter(f.customFieldId, vals)}
                            />
                        )
                    )}
                    <ManageListFiltersLink />
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
                    {/* Deleted leads are hidden from every view by default; this is the only
                        place they surface, and the only route back for one (Restore). Admin-only,
                        matching the delete/restore endpoints' own check. */}
                    {canDeleteLeads && (
                        <Button
                            variant={showDeleted ? 'default' : 'outline'}
                            size="sm"
                            className={cn('h-10', showDeleted && 'bg-danger-600 hover:bg-danger-700')}
                            onClick={() => {
                                setShowDeleted((v) => !v);
                                setPage(0);
                                setSelectedLeads(new Map());
                            }}
                            title={showDeleted ? 'Back to active leads' : 'Show deleted leads'}
                        >
                            <Trash className="mr-1.5 size-4" />
                            {showDeleted ? 'Viewing deleted' : 'Deleted leads'}
                        </Button>
                    )}
                    <ManageColumnsPopover
                        columns={toggleableColumns}
                        hiddenColumns={hiddenColumns}
                        onToggle={toggleColumn}
                        onReset={resetColumns}
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-10"
                        onClick={() => {
                            setSelectedExportCols(
                                new Set(exportColumnOptions.map((c) => c.key))
                            );
                            setExportPickerOpen(true);
                        }}
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
                    {/* Bulk-action toolbar — any view with a selection (assign / remove counsellor). */}
                    {selectedLeads.size > 0 && (
                        <div className="mb-2 flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 px-3 py-2">
                            <span className="text-body font-medium text-primary-700">
                                {selectedLeads.size} selected
                            </span>
                            <div className="flex gap-2">
                                {selectedLeads.size < totalElements && (
                                    <MyButton
                                        buttonType="text"
                                        scale="small"
                                        disable={selectAllLoading}
                                        onClick={selectAllAcrossPages}
                                    >
                                        {selectAllLoading
                                            ? 'Selecting…'
                                            : `Select all ${totalElements}`}
                                    </MyButton>
                                )}
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => setSelectedLeads(new Map())}
                                >
                                    Clear
                                </MyButton>
                                <MyDropdown
                                    dropdownList={[
                                        {
                                            label: 'Assign leads',
                                            value: 'assign',
                                            icon: <UserPlus className="size-4" />,
                                        },
                                        {
                                            label: 'Unassign leads',
                                            value: 'unassign',
                                            icon: <UserMinus className="size-4" />,
                                        },
                                        // Delete/restore are admin-only, matching the endpoints'
                                        // own check. In the deleted-leads view the only sensible
                                        // action is putting them back.
                                        ...(canDeleteLeads
                                            ? [
                                                  showDeleted
                                                      ? {
                                                            label: 'Restore leads',
                                                            value: 'restore',
                                                            icon: (
                                                                <ArrowCounterClockwise className="size-4 text-primary-600" />
                                                            ),
                                                        }
                                                      : {
                                                            label: 'Delete leads',
                                                            value: 'delete',
                                                            icon: (
                                                                <Trash className="size-4 text-danger-600" />
                                                            ),
                                                        },
                                              ]
                                            : []),
                                    ]}
                                    onSelect={(value) => {
                                        if (value === 'delete') {
                                            setBulkDeleteOpen(true);
                                            return;
                                        }
                                        if (value === 'restore') {
                                            restoreMutation.mutate();
                                            return;
                                        }
                                        setBulkActionMode(
                                            value === 'unassign' ? 'REMOVE' : 'ROUND_ROBIN'
                                        );
                                        setBulkAssignOpen(true);
                                    }}
                                >
                                    <MyButton buttonType="primary" scale="small">
                                        Bulk actions
                                        <CaretDown className="size-3.5" />
                                    </MyButton>
                                </MyDropdown>
                            </div>
                        </div>
                    )}
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
                            alwaysShowActions
                            onStatusUpdated={handleStatusUpdated}
                            hiddenColumns={hiddenColumns}
                            selectable
                            selectedIds={new Set(selectedLeads.keys())}
                            onToggleRow={toggleLeadRow}
                            onToggleAll={toggleAllLeads}
                            sortBy={sortBy}
                            sortDirection={sortDirection}
                            onSortChange={handleSortChange}
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

                <BulkAssignCounsellorDialog
                    open={bulkAssignOpen}
                    onOpenChange={setBulkAssignOpen}
                    instituteId={instituteId ?? ''}
                    leads={Array.from(selectedLeads.values())}
                    counsellorOptions={assignableCounsellorOptions}
                    initialMode={bulkActionMode}
                    onSuccess={handleBulkAssignSuccess}
                />

                <DeleteLeadsDialog
                    open={bulkDeleteOpen}
                    onOpenChange={setBulkDeleteOpen}
                    instituteId={instituteId ?? ''}
                    responseIds={Array.from(selectedLeads.keys())}
                    onSuccess={() => {
                        setSelectedLeads(new Map());
                        handleStatusUpdated();
                    }}
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
                <AiCallDialog
                    target={aiCallTarget}
                    onClose={() => setAiCallTarget(null)}
                    isPending={placeAiCall.isPending}
                    onConfirm={(target, agentId, numberId) => {
                        placeAiCall.mutate(
                            {
                                responseId: target.responseId,
                                userId: target.userId,
                                leadName: target.leadName,
                                campaignId: agentId || undefined,
                                preferredNumberId: numberId || undefined,
                            },
                            { onSuccess: () => setAiCallTarget(null) }
                        );
                    }}
                />
            </SidebarProvider>

            {/* Pagination */}
            <LeadPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

            <ExportColumnPickerDialog
                open={exportPickerOpen}
                onOpenChange={setExportPickerOpen}
                columns={exportColumnOptions}
                selected={selectedExportCols}
                onSelectedChange={setSelectedExportCols}
                onExport={() => {
                    setExportPickerOpen(false);
                    handleExportAll();
                }}
                isExporting={isExporting}
            />
        </div>
    );
};
