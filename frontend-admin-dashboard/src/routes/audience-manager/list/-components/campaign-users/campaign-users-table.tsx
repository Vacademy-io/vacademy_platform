import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useLeadCounsellorOptions } from '@/hooks/use-lead-counsellor-options';
import { CounsellorFilter } from '@/components/shared/leads/counsellor-filter';
import { CustomFieldMultiSelectFilter } from '@/components/shared/leads/custom-field-multi-select-filter';
import { useLeadFilterCustomFields } from '@/components/shared/leads/use-lead-filter-custom-fields';
import { toast } from 'sonner';
import {
    MagnifyingGlass,
    Funnel,
    Flame,
    CheckCircle,
    UserPlus,
    UploadSimple,
    DownloadSimple,
    PaperPlaneTilt,
    X,
    Clock,
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
import { StudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-side-view';
import { StudentSidebarProvider } from '@/routes/manage-students/students-list/-providers/student-sidebar-provider';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import { useLeadStatuses } from '@/hooks/use-lead-statuses';
import { useLeadProfiles, fetchBatchProfiles } from '@/hooks/use-lead-profiles';
import { useLatestNotesBatch, fetchLatestNotesBatch } from '@/hooks/use-latest-notes-batch';
import {
    fetchLeadJourneyBatch,
    formatJourneyForExport,
    type JourneyEvent,
} from '@/components/shared/leads/lead-journey-export';
import { useCampaignUsers } from '../../-hooks/useCampaignUsers';
import { useCustomFieldSetup } from '../../-hooks/useCustomFieldSetup';
import { CustomFieldSetupItem } from '../../-services/get-custom-field-setup';
import { fetchCampaignLeads } from '../../-services/get-campaign-users';
import { CampaignUserTable } from './campaign-users-columns';
import { convertToLocalDateTime } from '@/constants/helper';
import { cn, parseHtmlToString } from '@/lib/utils';
import { LeadBulkImportDialog } from './LeadBulkImportDialog';
import { SendMessageDialog } from './SendMessageDialog';
import { CommunicationHistory } from './CommunicationHistory';
import { parseCustomFieldsFromJson } from '../../-utils/lead-bulk-import-utils';
import { AddLeadNoteDialog } from '@/components/shared/add-lead-note-dialog';
import { BulkAssignCounsellorDialog } from '@/components/shared/leads/bulk-assign-counsellor-dialog';
import type { LeadCardVM } from '@/components/shared/leads/lead-view-model';
import { MyButton } from '@/components/design-system/button';
import { AssignCounselorToLeadDialog } from '@/components/shared/assign-counselor-to-lead-dialog';
import {
    LeadEmptyState,
    LeadTable,
    LeadPagination,
    useUpdateLeadTier,
    campaignRowToVM,
    type LeadActionHandlers,
} from '@/components/shared/leads';

const ALL_VALUE = '__ALL__'; // every lead regardless of status (default — enrolled leads stay visible)
const ALL_ACTIVE_VALUE = '__ACTIVE__'; // all leads except those enrolled/Converted
const ALL_CONVERTED_VALUE = '__CONVERTED__'; // only leads enrolled into a course
const ALL_SLA_VALUE = '__ALL_SLA__'; // every lead regardless of SLA stage (TAT / follow-up)
type SlaFilter =
    | 'TAT_BEFORE'
    | 'TAT_OVERDUE'
    | 'FOLLOW_UP_DUE'
    | 'FOLLOW_UP_OVERDUE'
    | 'ANY_OVERDUE';
const SLA_OPTIONS: { value: string; label: string }[] = [
    { value: ALL_SLA_VALUE, label: 'All SLA states' },
    { value: 'ANY_OVERDUE', label: 'Any overdue' },
    { value: 'TAT_OVERDUE', label: 'Reach-out overdue' },
    { value: 'TAT_BEFORE', label: 'Reach-out due soon' },
    { value: 'FOLLOW_UP_DUE', label: 'Follow-up due' },
    { value: 'FOLLOW_UP_OVERDUE', label: 'Follow-up overdue' },
];
const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

// Force-filled primary CTA so the page's primary action carries weight.
const PRIMARY_BTN = 'bg-primary-500 text-white shadow-sm hover:bg-primary-600';

const generateKeyFromName = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

const csvSafe = (val: unknown) => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

interface CampaignUsersTableProps {
    campaignId: string;
    campaignName?: string;
    customFieldsJson?: string;
    campaignType?: string;
}

/** Outer wrapper — keeps StudentSidebar context scoped to this page. */
export const CampaignUsersTable = (props: CampaignUsersTableProps) => (
    <StudentSidebarProvider>
        <CampaignUsersContent {...props} />
    </StudentSidebarProvider>
);

const CampaignUsersContent = ({
    campaignId,
    campaignName,
    customFieldsJson,
    campaignType,
}: CampaignUsersTableProps) => {
    const isOptOut = !!campaignType?.toUpperCase().includes('OPT_OUT');
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { setSelectedStudent } = useStudentSidebar();

    // ── Filter state ─────────────────────────────────────────
    const [page, setPage] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [tierFilter, setTierFilter] = useState<string>(ALL_VALUE);
    const [leadStatusFilter, setLeadStatusFilter] = useState<string>(ALL_VALUE);
    // SLA-state filter — maps to `audience_response.tat_reminder_stage` (and live-derived
    // `submitted_at + tatHours` for TAT buckets). ALL_SLA_VALUE = no filter.
    const [slaFilter, setSlaFilter] = useState<string>(ALL_SLA_VALUE);
    // Counsellor filter — userId of the assigned counsellor. Empty = all counsellors.
    const ALL_COUNSELLORS_VALUE = '__ALL_COUNSELLORS__';
    // Sentinel for the "Unassigned" dropdown entry → leads no counsellor owns
    // (sent to the backend as is_unassigned: true, assigned_counselor_id omitted).
    const UNASSIGNED_COUNSELLOR_VALUE = '__UNASSIGNED__';
    const [counsellorFilter, setCounsellorFilter] = useState<string>(ALL_COUNSELLORS_VALUE);
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
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>({
        from: '',
        to: '',
    });

    // Custom-field filters — keyed by custom_field_id → selected values (multi-select).
    // Only fields the admin enabled in Lead Settings render a control.
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
    const customFieldFiltersPayload = useMemo(
        () =>
            Object.entries(customFieldFilters)
                .filter(([, vals]) => vals.length > 0)
                .map(([field_id, values]) => ({ field_id, values })),
        [customFieldFilters]
    );

    // ── Dialog state ─────────────────────────────────────────
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [showSendMessage, setShowSendMessage] = useState(false);
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
    const [isExporting, setIsExporting] = useState(false);

    // Debounce search input → appliedSearch (drives the query key).
    useEffect(() => {
        const trimmed = searchInput.trim();
        if (trimmed === appliedSearch) return;
        const timer = window.setTimeout(() => {
            setAppliedSearch(trimmed);
            setPage(0);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchInput, appliedSearch]);

    // Reset all state when the campaign changes — filter values are campaign-specific.
    useEffect(() => {
        setPage(0);
        setSearchInput('');
        setAppliedSearch('');
        setTierFilter(ALL_VALUE);
        setLeadStatusFilter(ALL_VALUE);
        setFromDate('');
        setToDate('');
        setAppliedRange({ from: '', to: '' });
        setCustomFieldFilters({});
    }, [campaignId]);

    // ── Custom-field setup (drives the side panel's response card) ───────────
    const bulkImportCustomFields = useMemo(
        () => parseCustomFieldsFromJson(customFieldsJson),
        [customFieldsJson]
    );
    const customFields = useMemo(() => {
        if (!customFieldsJson) return [];
        try {
            const parsed = JSON.parse(customFieldsJson);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }, [customFieldsJson]);

    const { data: customFieldSetup, isLoading: isCfLoading } = useCustomFieldSetup(instituteId);
    const customFieldMap = useMemo(() => {
        const map = new Map<string, CustomFieldSetupItem>();
        if (!customFieldSetup) return map;
        customFieldSetup.forEach((field) => {
            const reg = (key?: string) => {
                if (!key) return;
                map.set(key, field);
                map.set(key.toLowerCase(), field);
                map.set(key.toUpperCase(), field);
                const norm = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                if (norm && norm !== key.toLowerCase()) map.set(norm, field);
            };
            reg(field.custom_field_id);
            reg(field.field_key);
            if (field.field_name) reg(generateKeyFromName(field.field_name));
        });
        return map;
    }, [customFieldSetup]);

    const campaignFieldsMap = useMemo(() => {
        const map = new Map<string, { name: string; key?: string }>();
        map.set('opted_out_from', { name: 'Opted Out From', key: 'opted_out_from' });
        if (customFields.length === 0) return map;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customFields.forEach((cf: any) => {
            const fieldId = cf.custom_field?.id || cf.id || cf._id || cf.field_id;
            if (!fieldId) return;
            const meta = cf.custom_field || {};
            const fieldName = meta.fieldName || meta.field_name || cf.field_name || '';
            const fieldKey = meta.fieldKey || meta.field_key || generateKeyFromName(fieldName);
            if (!fieldName) return;
            map.set(fieldId, { name: fieldName, key: fieldKey });
            map.set(fieldId.toLowerCase(), { name: fieldName, key: fieldKey });
            map.set(fieldId.toUpperCase(), { name: fieldName, key: fieldKey });
        });
        return map;
    }, [customFields]);

    // ── Server query ─────────────────────────────────────────
    const leadsPayload = useMemo(() => {
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
        return {
            audience_id: campaignId,
            page,
            size: PAGE_SIZE,
            sort_by: 'SUBMITTED_AT',
            sort_direction: 'DESC' as const,
            submitted_from_local: startOfDayIso(appliedRange.from),
            submitted_to_local: endOfDayIso(appliedRange.to),
            search_query: appliedSearch || undefined,
            lead_tier: tierFilter === ALL_VALUE ? undefined : tierFilter,
            lead_status_id:
                leadStatusFilter === ALL_ACTIVE_VALUE ||
                leadStatusFilter === ALL_VALUE ||
                leadStatusFilter === ALL_CONVERTED_VALUE
                    ? undefined
                    : leadStatusFilter,
            conversion_status_filter: (leadStatusFilter === ALL_ACTIVE_VALUE
                ? 'EXCLUDE_CONVERTED'
                : leadStatusFilter === ALL_CONVERTED_VALUE
                  ? 'ONLY_CONVERTED'
                  : 'ALL') as 'EXCLUDE_CONVERTED' | 'ALL' | 'ONLY_CONVERTED',
            sla_filter: slaFilter === ALL_SLA_VALUE ? undefined : (slaFilter as SlaFilter),
            assigned_counselor_id:
                counsellorFilter === ALL_COUNSELLORS_VALUE ||
                counsellorFilter === UNASSIGNED_COUNSELLOR_VALUE
                    ? undefined
                    : counsellorFilter,
            is_unassigned: counsellorFilter === UNASSIGNED_COUNSELLOR_VALUE ? true : undefined,
            custom_field_filters: customFieldFiltersPayload.length
                ? customFieldFiltersPayload
                : undefined,
        };
    }, [
        campaignId,
        page,
        appliedRange,
        appliedSearch,
        tierFilter,
        leadStatusFilter,
        slaFilter,
        counsellorFilter,
        customFieldFiltersPayload,
    ]);

    const { data: usersResponse, isLoading, error } = useCampaignUsers(leadsPayload);

    // ── Settings + per-row data ──────────────────────────────
    const leadSettings = useLeadSettings();
    const showOps = !leadSettings.isLoading && leadSettings.enabled;
    const showScore = showOps && leadSettings.showScoreInEnquiryTable;
    const { statuses: leadStatusCatalog } = useLeadStatuses();

    const leadUserIds = useMemo(
        () =>
            (usersResponse?.content ?? [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((lead: any) => lead.user?.id || lead.user_id || '')
                .filter((id: string): id is string => !!id),
        [usersResponse]
    );
    const { profiles: leadProfiles } = useLeadProfiles(leadUserIds, showOps);
    const { notesByUserId } = useLatestNotesBatch(leadUserIds, showOps);

    // ── Transform server rows → CampaignUserTable[] ─────────────
    const tableRows = useMemo<CampaignUserTable[]>(() => {
        if (!usersResponse?.content) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return usersResponse.content.map((lead: any, index: number) => {
            const user = lead.user || {};
            const customValues = lead.custom_field_values || {};
            const submittedAt = lead.submitted_at_local
                ? convertToLocalDateTime(lead.submitted_at_local)
                : '-';

            const responseFields: Array<{
                id: string;
                name: string;
                type: string;
                rawValue: string | null;
            }> = [];
            const apiMetaSrc = lead.custom_field_metadata ?? {};
            Object.entries(customValues).forEach(([fieldId, rawVal]) => {
                const value = rawVal == null ? null : String(rawVal);
                if (value === null || value === '') return;
                let name = fieldId;
                let type = 'textfield';
                const cf = campaignFieldsMap.get(fieldId);
                if (cf?.name) name = cf.name;
                const setup =
                    customFieldMap.get(fieldId) || customFieldMap.get(fieldId.toLowerCase());
                if (setup?.field_name) name = setup.field_name;
                if (setup?.field_type) type = setup.field_type;
                const apiMeta = apiMetaSrc[fieldId];
                if (apiMeta?.fieldName || apiMeta?.field_name)
                    name = apiMeta.fieldName ?? apiMeta.field_name;
                if (apiMeta?.fieldType || apiMeta?.field_type)
                    type = apiMeta.fieldType ?? apiMeta.field_type;
                responseFields.push({ id: fieldId, name, type, rawValue: value });
            });

            const row: CampaignUserTable = {
                id: lead.response_id || lead.user_id || `${index}`,
                index: page * PAGE_SIZE + index,
                submittedAt,
                full_name: user.full_name || user.name || lead.parent_name || null,
                email: user.email || lead.parent_email || null,
                phone_number: user.mobile_number || lead.parent_mobile || null,
                opted_out_from: lead.source_audience_name || null,
                _user_id: user.id || lead.user_id || null,
                _user: user,
                _custom_field_values: customValues,
                _audience_campaign_name: lead.campaign_name || campaignName || null,
                _tat_due_at: lead.tat_due_at ?? null,
                _follow_up_due_at: lead.follow_up_due_at ?? null,
                _tat_overdue: lead.tat_overdue ?? null,
                _tat_due_soon: lead.tat_due_soon ?? null,
                _follow_up_overdue: lead.follow_up_overdue ?? null,
                _first_response_at: lead.first_response_at ?? null,
                _lead_status: lead.lead_status ?? null,
                _response_id: lead.response_id ?? null,
                _response_fields: responseFields,
                // The submitted_at_local ISO is needed for the VM's relative time + sort.
                _submitted_iso: lead.submitted_at_local,
            };
            return row;
        });
    }, [usersResponse, page, customFieldMap, campaignFieldsMap, campaignName]);

    const totalElements = usersResponse?.totalElements ?? 0;
    const totalPages = usersResponse?.totalPages ?? 0;

    const vms = useMemo(() => tableRows.map(campaignRowToVM), [tableRows]);

    // ── Actions for the LeadTable ────────────────────────────
    const invalidateKeys: string[][] = [['campaignUsers', campaignId], ['lead-profiles-batch']];
    const updateTier = useUpdateLeadTier({ invalidateKeys });
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
        }),
        [setSelectedStudent, updateTier]
    );
    const handleStatusUpdated = () =>
        queryClient.invalidateQueries({ queryKey: ['campaignUsers', campaignId] });

    // ── Bulk assign counsellor (multi-select on the Unassigned view) ──
    const isUnassignedView = counsellorFilter === UNASSIGNED_COUNSELLOR_VALUE;
    const [selectedLeads, setSelectedLeads] = useState<Map<string, { userId: string; name: string }>>(
        new Map()
    );
    const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

    // Selection only applies to the Unassigned view; drop it on filter change.
    useEffect(() => {
        setSelectedLeads(new Map());
    }, [counsellorFilter]);

    const toggleLeadRow = (userId: string, vm: LeadCardVM) =>
        setSelectedLeads((prev) => {
            const next = new Map(prev);
            if (next.has(userId)) next.delete(userId);
            else next.set(userId, { userId, name: vm.name });
            return next;
        });

    const toggleAllLeads = (checked: boolean, selectableVms: LeadCardVM[]) =>
        setSelectedLeads((prev) => {
            const next = new Map(prev);
            selectableVms.forEach((v) => {
                if (!v.userId) return;
                if (checked) next.set(v.userId, { userId: v.userId, name: v.name });
                else next.delete(v.userId);
            });
            return next;
        });

    const handleBulkAssignSuccess = () => {
        setSelectedLeads(new Map());
        handleStatusUpdated();
    };

    // Select every lead matching the current filter (across all pages), not just
    // the rows on screen — fetches all ids in one call (same pattern as export).
    const [selectAllLoading, setSelectAllLoading] = useState(false);
    const selectAllAcrossPages = async () => {
        if (!totalElements) return;
        try {
            setSelectAllLoading(true);
            const res = await fetchCampaignLeads({ ...leadsPayload, page: 0, size: totalElements });
            const map = new Map<string, { userId: string; name: string }>();
            (res.content ?? []).forEach((lead) => {
                const uid = lead.user?.id || lead.user_id;
                if (!uid) return;
                map.set(uid, { userId: uid, name: lead.user?.full_name || lead.parent_name || uid });
            });
            setSelectedLeads(map);
        } catch {
            toast.error('Failed to select all leads');
        } finally {
            setSelectAllLoading(false);
        }
    };

    // Hide the "Lead source" column — every row in this view is from the same audience.
    const hiddenColumns = useMemo(() => new Set(['source']), []);

    // ── Filter handlers ──────────────────────────────────────
    const handleTierChange = (value: string) => {
        setPage(0);
        setTierFilter(value);
    };
    const handleLeadStatusChange = (value: string) => {
        setPage(0);
        setLeadStatusFilter(value);
    };
    const setCounsellor = (value: string) => {
        setPage(0);
        setCounsellorFilter(value);
    };
    const setSla = (value: string) => {
        setPage(0);
        setSlaFilter(value);
    };
    const handleApplyDate = () => {
        setPage(0);
        setAppliedRange({ from: fromDate, to: toDate });
    };
    const handleClearAllFilters = () => {
        setPage(0);
        setSearchInput('');
        setAppliedSearch('');
        setTierFilter(ALL_VALUE);
        setLeadStatusFilter(ALL_VALUE);
        setSlaFilter(ALL_SLA_VALUE);
        setCounsellorFilter(ALL_COUNSELLORS_VALUE);
        setFromDate('');
        setToDate('');
        setAppliedRange({ from: '', to: '' });
        setCustomFieldFilters({});
    };

    const isDateFilterActive = !!appliedRange.from || !!appliedRange.to;
    const isAnyFilterActive =
        isDateFilterActive ||
        !!appliedSearch ||
        tierFilter !== ALL_VALUE ||
        leadStatusFilter !== ALL_VALUE ||
        slaFilter !== ALL_SLA_VALUE ||
        counsellorFilter !== ALL_COUNSELLORS_VALUE ||
        customFieldFiltersPayload.length > 0;

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
    if (isDateFilterActive)
        chips.push({
            label: `Date: ${appliedRange.from || '…'} → ${appliedRange.to || '…'}`,
            onRemove: () => {
                setFromDate('');
                setToDate('');
                setAppliedRange({ from: '', to: '' });
            },
        });
    if (slaFilter !== ALL_SLA_VALUE)
        chips.push({
            label: `SLA: ${SLA_OPTIONS.find((o) => o.value === slaFilter)?.label ?? slaFilter}`,
            onRemove: () => setSla(ALL_SLA_VALUE),
        });
    if (counsellorFilter !== ALL_COUNSELLORS_VALUE) {
        const cName =
            counsellorFilter === UNASSIGNED_COUNSELLOR_VALUE
                ? 'Unassigned'
                : (counsellorOptions.find((c) => c.id === counsellorFilter)?.full_name ?? 'Selected');
        chips.push({
            label: `Counsellor: ${cName}`,
            onRemove: () => setCounsellor(ALL_COUNSELLORS_VALUE),
        });
    }
    customFieldFiltersPayload.forEach((f) => {
        const fieldName =
            filterCustomFields.find((cf) => cf.customFieldId === f.field_id)?.fieldName ?? 'Field';
        chips.push({
            label: `${fieldName}: ${f.values.join(', ')}`,
            onRemove: () => setCustomFieldFilter(f.field_id, []),
        });
    });

    // ── CSV export ───────────────────────────────────────────
    const handleExport = async () => {
        if (!totalElements) {
            toast.info('No leads to export');
            return;
        }
        setIsExporting(true);
        try {
            toast.info('Starting export…');
            const allDataPayload = { ...leadsPayload, page: 0, size: totalElements };
            const response = await fetchCampaignLeads(allDataPayload);
            if (!response.content || response.content.length === 0) {
                toast.info('No data to export');
                return;
            }

            // Batch-resolve counsellor + latest-note for the full export set.
            const exportUserIds = Array.from(
                new Set(
                    response.content
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .map((lead: any) => lead.user?.id || lead.user_id || '')
                        .filter((id: string): id is string => !!id)
                )
            );
            let exportProfiles: Record<string, { assigned_counselor_name?: string | null }> = {};
            let exportNotes: Record<
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
            > = {};
            let exportJourney: Record<string, JourneyEvent[]> = {};
            if (showOps && exportUserIds.length > 0) {
                try {
                    [exportProfiles, exportNotes, exportJourney] = await Promise.all([
                        fetchBatchProfiles(exportUserIds),
                        fetchLatestNotesBatch(exportUserIds),
                        fetchLeadJourneyBatch(exportUserIds),
                    ]);
                } catch (e) {
                    console.warn('Failed to enrich CSV with counsellor/notes/journey', e);
                }
            }

            // Discover all custom-field IDs present in this export so the CSV
            // captures every collected field even if a given row is missing some.
            const allFieldIds = new Set<string>();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            customFields.forEach((field: any) => {
                const fieldId = field.custom_field?.id || field.id || field._id || field.field_id;
                if (fieldId) allFieldIds.add(fieldId);
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            response.content.forEach((lead: any) => {
                const customValues = lead.custom_field_values || {};
                Object.keys(customValues).forEach((key) => allFieldIds.add(key));
            });
            const fieldIdsArray = Array.from(allFieldIds);

            const csvHeaders = ['Lead ID', 'Submitted At', 'Name', 'Email', 'Mobile'];
            const fieldIdToHeaderNameMap: Record<string, string> = {};
            fieldIdsArray.forEach((fieldId) => {
                let headerName = fieldId;
                const cf = campaignFieldsMap.get(fieldId);
                if (cf?.name) headerName = cf.name;
                const setup =
                    customFieldMap.get(fieldId) || customFieldMap.get(fieldId.toLowerCase());
                if (setup?.field_name) headerName = setup.field_name;
                fieldIdToHeaderNameMap[fieldId] = headerName;
                csvHeaders.push(headerName.includes(',') ? `"${headerName}"` : headerName);
            });
            const tailHeaders = showOps
                ? [
                      'Counsellor',
                      'Activity & Notes',
                      'Notes Count',
                      'Lead journey (disposition & notes)',
                  ]
                : [];
            csvHeaders.push(...tailHeaders);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const csvRows = response.content.map((lead: any) => {
                const user = lead.user || {};
                const customValues = lead.custom_field_values || {};
                const submittedAt = lead.submitted_at_local
                    ? convertToLocalDateTime(lead.submitted_at_local)
                    : '-';
                const row = [
                    csvSafe(lead.response_id || lead.user_id || '-'),
                    csvSafe(submittedAt),
                    csvSafe(user.full_name || user.name || '-'),
                    csvSafe(user.email || '-'),
                    csvSafe(user.mobile_number || '-'),
                ];
                fieldIdsArray.forEach((fieldId) => {
                    row.push(csvSafe(customValues[fieldId]));
                });
                if (showOps) {
                    const userId = user.id || lead.user_id || '';
                    const counsellor = userId
                        ? exportProfiles[userId]?.assigned_counselor_name ?? ''
                        : '';
                    const summary = userId ? exportNotes[userId] : undefined;
                    const recent = summary?.recent ?? [];
                    const notesBlock = recent
                        .map((n, idx) => {
                            const label = n.title?.trim() || 'Note';
                            const rawBody = n.description ?? '';
                            const body = (
                                /<\/?[a-z][^>]*>/i.test(rawBody)
                                    ? parseHtmlToString(rawBody)
                                    : rawBody
                            ).trim();
                            const date = n.created_at ? convertToLocalDateTime(n.created_at) : '';
                            return [
                                `${idx + 1}. ${label} - ${body}`,
                                `   updatedby - ${n.actor_name || ''}`,
                                `   date - ${date}`,
                            ].join('\n');
                        })
                        .join('\n\n');
                    row.push(
                        csvSafe(counsellor),
                        csvSafe(notesBlock),
                        csvSafe(summary?.count ?? 0),
                        csvSafe(formatJourneyForExport(userId ? exportJourney[userId] : undefined))
                    );
                }
                return row.join(',');
            });

            const csv = [csvHeaders.join(','), ...csvRows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute(
                'download',
                `${campaignName || 'campaign_users'}_${new Date().toISOString().split('T')[0]}.csv`
            );
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success(`Exported ${response.content.length} leads`);
        } catch (err) {
            console.error('Export failed:', err);
            toast.error('Failed to export leads');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex w-full flex-col gap-6">
            {/* Heading */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1
                        className="truncate text-2xl font-semibold leading-tight text-neutral-900"
                        title={campaignName}
                    >
                        {campaignName ?? 'Audience List'}
                    </h1>
                    <p className="mt-1 text-sm text-neutral-500">
                        {isLoading
                            ? 'Loading respondents…'
                            : `${totalElements.toLocaleString()} ${totalElements === 1 ? 'respondent' : 'respondents'}`}
                    </p>
                </div>
                {!isOptOut && (
                    <Button
                        onClick={() =>
                            navigate({
                                to: '/audience-manager/list/campaign-users/add',
                                search: {
                                    campaignId,
                                    campaignName,
                                    customFields: customFieldsJson,
                                },
                                // Router's typed search doesn't model these dynamic params.
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            } as any)
                        }
                        className={cn('w-full shrink-0 sm:w-auto', PRIMARY_BTN)}
                    >
                        <UserPlus className="mr-2 size-4" /> Add Response
                    </Button>
                )}
            </div>

            {/* Toolbar — left filters, right actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={tierFilter} onValueChange={handleTierChange}>
                        <SelectTrigger className="h-10 w-36">
                            <Flame className="mr-1.5 size-4 text-neutral-400" />
                            <SelectValue placeholder="All tiers" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_VALUE}>All tiers</SelectItem>
                            <SelectItem value="HOT">Hot</SelectItem>
                            <SelectItem value="WARM">Warm</SelectItem>
                            <SelectItem value="COLD">Cold</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={leadStatusFilter} onValueChange={handleLeadStatusChange}>
                        <SelectTrigger className="h-10 w-44">
                            <CheckCircle className="mr-1.5 size-4 text-neutral-400" />
                            <SelectValue placeholder="All leads" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_VALUE}>All leads</SelectItem>
                            <SelectItem value={ALL_ACTIVE_VALUE}>Active (not enrolled)</SelectItem>
                            <SelectItem value={ALL_CONVERTED_VALUE}>Enrolled / Converted</SelectItem>
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
                                <SelectValue placeholder="All SLA states" />
                            </SelectTrigger>
                            <SelectContent>
                                {SLA_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
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
                            unassignedValue={UNASSIGNED_COUNSELLOR_VALUE}
                            options={counsellorOptions}
                            isLoading={counsellorOptionsLoading}
                        />
                    )}
                    {filterCustomFields.map((f) => (
                        <CustomFieldMultiSelectFilter
                            key={f.customFieldId}
                            instituteId={instituteId ?? ''}
                            fieldId={f.customFieldId}
                            fieldName={f.fieldName}
                            selected={customFieldFilters[f.customFieldId] ?? []}
                            onChange={(vals) => setCustomFieldFilter(f.customFieldId, vals)}
                        />
                    ))}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-10">
                                <Funnel className="mr-1.5 size-4" />
                                More filters
                                {isDateFilterActive && (
                                    <span className="ml-1.5 size-1.5 rounded-full bg-primary-500" />
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-72 space-y-3">
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

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-10"
                        onClick={() => setShowSendMessage(true)}
                    >
                        <PaperPlaneTilt className="mr-1.5 size-4" />
                        Send message
                    </Button>
                    {!isOptOut && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10"
                            onClick={() => setShowBulkImport(true)}
                        >
                            <UploadSimple className="mr-1.5 size-4" />
                            Import CSV
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-10"
                        onClick={handleExport}
                        disabled={isExporting || !totalElements}
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
                    {isAnyFilterActive && (
                        <button
                            type="button"
                            onClick={handleClearAllFilters}
                            className="px-1 text-xs font-medium text-primary-600 hover:underline"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            )}

            {/* Search + result count */}
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
                <div className="text-sm text-neutral-500">
                    Showing {tableRows.length.toLocaleString()} of {totalElements.toLocaleString()}{' '}
                    results
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
                    {/* Bulk-assign toolbar — only on the Unassigned view with a selection. */}
                    {isUnassignedView && selectedLeads.size > 0 && (
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
                                <MyButton
                                    buttonType="primary"
                                    scale="small"
                                    onClick={() => setBulkAssignOpen(true)}
                                >
                                    <UserPlus className="size-3.5" />
                                    Assign counsellor
                                </MyButton>
                            </div>
                        </div>
                    )}
                    {error ? (
                        <LeadEmptyState
                            title="Couldn't load respondents"
                            description="Something went wrong fetching the campaign users. Try again."
                        />
                    ) : (
                        <LeadTable
                            vms={vms}
                            profiles={leadProfiles}
                            notes={notesByUserId}
                            statuses={leadStatusCatalog}
                            showOps={showOps}
                            showScore={showScore}
                            isLoading={isLoading || isCfLoading}
                            actions={actions}
                            onStatusUpdated={handleStatusUpdated}
                            hiddenColumns={hiddenColumns}
                            selectable={isUnassignedView}
                            selectedIds={new Set(selectedLeads.keys())}
                            onToggleRow={toggleLeadRow}
                            onToggleAll={toggleAllLeads}
                            emptyState={
                                <LeadEmptyState
                                    title={
                                        isAnyFilterActive
                                            ? 'No respondents match these filters'
                                            : 'No respondents yet'
                                    }
                                    description={
                                        isAnyFilterActive
                                            ? 'Try clearing the filters to see more results.'
                                            : 'When people fill out this audience form, they will show up here.'
                                    }
                                    onClear={isAnyFilterActive ? handleClearAllFilters : undefined}
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
                    onSuccess={handleBulkAssignSuccess}
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

            {/* Communication history for this campaign */}
            <CommunicationHistory campaignId={campaignId} />

            {/* Dialogs anchored at the page level */}
            <LeadBulkImportDialog
                open={showBulkImport}
                onOpenChange={setShowBulkImport}
                campaignId={campaignId}
                campaignName={campaignName || 'Campaign'}
                instituteId={instituteId || ''}
                customFields={bulkImportCustomFields}
            />
            <SendMessageDialog
                open={showSendMessage}
                onOpenChange={setShowSendMessage}
                campaignId={campaignId}
                campaignName={campaignName || 'Campaign'}
                instituteId={instituteId || ''}
                customFields={bulkImportCustomFields}
                leadCount={totalElements}
            />
        </div>
    );
};
