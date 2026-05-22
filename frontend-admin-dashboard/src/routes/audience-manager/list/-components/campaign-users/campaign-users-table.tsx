import { useMemo, useState, useEffect, useCallback } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { MyTable } from '@/components/design-system/table';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import EmptyInvitePage from '@/assets/svgs/empty-invite-page.svg';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import {
    ChevronLeft,
    ChevronRight,
    Download,
    Upload,
    UserPlus,
    MessageSquare,
    Calendar,
    Search,
    Flame,
    CheckCircle2,
    ArrowUpDown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCampaignUsers } from '../../-hooks/useCampaignUsers';
import {
    campaignUsersColumns,
    CampaignUserTable,
    generateDynamicColumns,
} from './campaign-users-columns';
import { deleteAudienceLead } from '../../-services/delete-audience-lead';
import { convertToLocalDateTime } from '@/constants/helper';
import { useCustomFieldSetup } from '../../-hooks/useCustomFieldSetup';
import { CustomFieldSetupItem } from '../../-services/get-custom-field-setup';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { toast } from 'sonner';
import { fetchCampaignLeads } from '../../-services/get-campaign-users';
import { LeadBulkImportDialog } from './LeadBulkImportDialog';
import { SendMessageDialog } from './SendMessageDialog';
import { CommunicationHistory } from './CommunicationHistory';
import { parseCustomFieldsFromJson } from '../../-utils/lead-bulk-import-utils';
import { SidebarProvider } from '@/components/ui/sidebar';
import { StudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-side-view';
import { StudentSidebarProvider } from '@/routes/manage-students/students-list/-providers/student-sidebar-provider';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { StudentTable } from '@/types/student-table-types';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import { useLeadStatuses } from '@/hooks/use-lead-statuses';
import { useLeadProfiles, fetchBatchProfiles } from '@/hooks/use-lead-profiles';
import { useLatestNotesBatch, fetchLatestNotesBatch } from '@/hooks/use-latest-notes-batch';
import { AddLeadNoteDialog } from '@/components/shared/add-lead-note-dialog';
import { AssignCounselorToLeadDialog } from '@/components/shared/assign-counselor-to-lead-dialog';

// Helper function to generate key from name
const generateKeyFromName = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

// Sentinel for "any value" / "all tiers" — shadcn `<Select>` rejects empty
// strings as item values, so we use a marker and translate on the way out.
const ALL_VALUE = '__ALL__';
const ALL_ACTIVE_VALUE = '__ACTIVE__'; // Lead Status filter: all leads except Converted (default)
const SEARCH_DEBOUNCE_MS = 500;

// Sort options. Values map to the backend's LeadFilterDTO sort_by + sort_direction.
// Backend supports SUBMITTED_AT, LEAD_SCORE, PARENT_NAME — exposed here as the
// two most useful for the campaign-users table.
type SortOption =
    | 'SUBMITTED_AT_DESC'
    | 'SUBMITTED_AT_ASC'
    | 'LEAD_SCORE_DESC'
    | 'LEAD_SCORE_ASC';
const DEFAULT_SORT: SortOption = 'SUBMITTED_AT_DESC';
const SORT_LABELS: Record<SortOption, string> = {
    SUBMITTED_AT_DESC: 'Newest first',
    SUBMITTED_AT_ASC: 'Oldest first',
    LEAD_SCORE_DESC: 'Lead score (high → low)',
    LEAD_SCORE_ASC: 'Lead score (low → high)',
};
const splitSort = (s: SortOption): { sortBy: string; sortDirection: 'ASC' | 'DESC' } => {
    if (s === 'SUBMITTED_AT_ASC') return { sortBy: 'SUBMITTED_AT', sortDirection: 'ASC' };
    if (s === 'LEAD_SCORE_DESC') return { sortBy: 'LEAD_SCORE', sortDirection: 'DESC' };
    if (s === 'LEAD_SCORE_ASC') return { sortBy: 'LEAD_SCORE', sortDirection: 'ASC' };
    return { sortBy: 'SUBMITTED_AT', sortDirection: 'DESC' };
};

interface DropdownFilterField {
    id: string;
    name: string;
    options: string[];
}

// Extract dropdown-type custom fields with their option values from the
// campaign config. Defensive about both shapes the backend serializes
// (`{ custom_field: { ... } }` wrapper vs flat) and a few `options` formats
// (string[], { id, value }[], { value }[]).
const extractDropdownFilterFields = (rawFields: any[]): DropdownFilterField[] => {
    if (!Array.isArray(rawFields) || rawFields.length === 0) return [];

    return rawFields
        .map((entry: any): DropdownFilterField | null => {
            const cf = entry?.custom_field || entry || {};
            const id = cf.id || entry?.id || entry?._id || entry?.field_id || cf.custom_field_id;
            const type = (
                cf.fieldType ||
                cf.field_type ||
                cf.type ||
                entry?.field_type ||
                entry?.type ||
                ''
            )
                .toString()
                .toLowerCase();
            const name =
                cf.fieldName || cf.field_name || cf.name || entry?.field_name || entry?.name || '';
            const rawOptions =
                cf.options ||
                entry?.options ||
                cf.dropdown_options ||
                entry?.dropdown_options ||
                [];

            if (!id || !name) return null;
            if (!type.includes('dropdown') && !type.includes('select')) return null;
            if (!Array.isArray(rawOptions) || rawOptions.length === 0) return null;

            const options = rawOptions
                .map((o: any) => {
                    if (o == null) return '';
                    if (typeof o === 'string') return o;
                    return o.value ?? o.label ?? o.name ?? '';
                })
                .filter((v: string) => typeof v === 'string' && v.length > 0);
            if (options.length === 0) return null;
            // Deduplicate while preserving first-seen order.
            const seen = new Set<string>();
            const dedup: string[] = [];
            for (const v of options) {
                if (!seen.has(v)) {
                    seen.add(v);
                    dedup.push(v);
                }
            }
            return { id, name, options: dedup };
        })
        .filter((x): x is DropdownFilterField => !!x);
};

interface CampaignUsersTableProps {
    campaignId: string;
    campaignName?: string;
    customFieldsJson?: string;
    campaignType?: string;
}

export const CampaignUsersTable = ({
    campaignId,
    campaignName,
    customFieldsJson,
    campaignType,
}: CampaignUsersTableProps) => {
    const isOptOut = campaignType?.toUpperCase().includes('OPT_OUT');
    const [page, setPage] = useState(0);
    const pageSize = 10;
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id;
    const [isDownloading, setIsDownloading] = useState(false);
    const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
    const [showSendMessageDialog, setShowSendMessageDialog] = useState(false);
    // Date filter state (yyyy-mm-dd from native input). `appliedRange` is what
    // actually drives the query — `fromDate`/`toDate` are the in-progress
    // values until the user clicks Apply.
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>({
        from: '',
        to: '',
    });
    const isDateFilterActive = !!appliedRange.from || !!appliedRange.to;

    // Substring search across name / email / phone — debounced so typing
    // doesn't fire a query on every keystroke.
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

    // Lead tier filter — applied immediately (discrete select).
    const [tierFilter, setTierFilter] = useState<string>(ALL_VALUE);

    // Unified Lead Status filter (combines pipeline status + conversion state):
    //   ALL_ACTIVE_VALUE → all leads except Converted (default)
    //   ALL_VALUE        → every lead regardless of status
    //   <statusKey>      → only leads currently in that status
    const [leadStatusFilter, setLeadStatusFilter] = useState<string>(ALL_ACTIVE_VALUE);

    // Per-campaign dropdown filters: maps custom_field_id → selected option
    // value. Each dropdown narrows the result set with AND semantics on the
    // backend.
    const [cfFilters, setCfFilters] = useState<Record<string, string>>({});

    // Sort selector — defaults to newest submissions first.
    const [sortOption, setSortOption] = useState<SortOption>(DEFAULT_SORT);

    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const bulkImportCustomFields = useMemo(
        () => parseCustomFieldsFromJson(customFieldsJson),
        [customFieldsJson]
    );

    // Reset page when campaign changes
    useEffect(() => {
        setPage(0);
        // Drop campaign-specific filter state on switch — dropdown options
        // are unique to a campaign so carrying them over would 0 out the list.
        setCfFilters({});
        setTierFilter(ALL_VALUE);
        setSearchInput('');
        setAppliedSearch('');
        setFromDate('');
        setToDate('');
        setAppliedRange({ from: '', to: '' });
        setLeadStatusFilter(ALL_ACTIVE_VALUE);
        setSortOption(DEFAULT_SORT);
        console.log('🔄 [CampaignUsersTable] Campaign changed, resetting page to 0');
    }, [campaignId]);

    // Parse custom fields from JSON
    const customFields = useMemo(() => {
        if (!customFieldsJson) return [];
        try {
            const parsed = JSON.parse(customFieldsJson);
            const fields = Array.isArray(parsed) ? parsed : [];
            return fields;
        } catch (error) {
            console.error('Error parsing custom fields:', error);
            return [];
        }
    }, [customFieldsJson]);

    const {
        data: customFieldSetup,
        isLoading: isCustomFieldsLoading,
        error: customFieldsError,
    } = useCustomFieldSetup(instituteId);

    const customFieldMap = useMemo(() => {
        const map = new Map<string, CustomFieldSetupItem>();
        if (!customFieldSetup || customFieldSetup.length === 0) {
            return map;
        }

        customFieldSetup.forEach((field) => {
            const registerKey = (key?: string) => {
                if (!key) return;
                map.set(key, field);
                map.set(key.toLowerCase(), field);
                map.set(key.toUpperCase(), field);
                const normalized = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                if (normalized && normalized !== key.toLowerCase()) {
                    map.set(normalized, field);
                }
            };

            registerKey(field.custom_field_id);
            registerKey(field.field_key);
            if (field.field_name) {
                const nameKey = generateKeyFromName(field.field_name);
                registerKey(nameKey);
            }
        });
        return map;
    }, [customFieldSetup]);

    // Dropdown-type custom fields surface as filter Selects above the table.
    const dropdownFilterFields = useMemo(
        () => extractDropdownFilterFields(customFields),
        [customFields]
    );

    const leadsPayload = useMemo(() => {
        // Convert yyyy-mm-dd input values to ISO timestamps spanning the full
        // local day, matching the format the backend's `LeadFilterDTO` parses.
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
        const customFieldFilters = Object.entries(cfFilters)
            .filter(([, v]) => !!v)
            .map(([field_id, value]) => ({ field_id, value }));
        const { sortBy, sortDirection } = splitSort(sortOption);
        return {
            audience_id: campaignId,
            page,
            size: pageSize,
            sort_by: sortBy,
            sort_direction: sortDirection,
            submitted_from_local: startOfDayIso(appliedRange.from),
            submitted_to_local: endOfDayIso(appliedRange.to),
            search_query: appliedSearch || undefined,
            lead_tier: tierFilter === ALL_VALUE ? undefined : tierFilter,
            // Unified Lead Status filter → backend params:
            //   ALL_ACTIVE_VALUE → no specific status; hide Converted
            //   ALL_VALUE        → no specific status; show every state
            //   <statusKey>      → that specific status
            lead_status_id:
                leadStatusFilter === ALL_ACTIVE_VALUE || leadStatusFilter === ALL_VALUE
                    ? undefined
                    : leadStatusFilter,
            custom_field_filters: customFieldFilters.length > 0 ? customFieldFilters : undefined,
            conversion_status_filter: (leadStatusFilter === ALL_ACTIVE_VALUE
                ? 'EXCLUDE_CONVERTED'
                : 'ALL') as 'EXCLUDE_CONVERTED' | 'ALL',
        };
    }, [
        campaignId,
        page,
        pageSize,
        appliedRange,
        appliedSearch,
        tierFilter,
        leadStatusFilter,
        cfFilters,
        sortOption,
    ]);

    const handleApplyDateFilter = () => {
        setPage(0);
        setAppliedRange({ from: fromDate, to: toDate });
    };
    const handleClearDateFilter = () => {
        setFromDate('');
        setToDate('');
        setPage(0);
        setAppliedRange({ from: '', to: '' });
    };

    const handleTierChange = (value: string) => {
        setPage(0);
        setTierFilter(value);
    };

    const handleLeadStatusFilterChange = (value: string) => {
        setPage(0);
        setLeadStatusFilter(value);
    };

    const handleCfFilterChange = (fieldId: string, value: string) => {
        setPage(0);
        setCfFilters((prev) => {
            const next = { ...prev };
            if (value === ALL_VALUE) {
                delete next[fieldId];
            } else {
                next[fieldId] = value;
            }
            return next;
        });
    };

    const handleClearAllFilters = () => {
        setFromDate('');
        setToDate('');
        setAppliedRange({ from: '', to: '' });
        setSearchInput('');
        setAppliedSearch('');
        setTierFilter(ALL_VALUE);
        setLeadStatusFilter(ALL_ACTIVE_VALUE);
        setCfFilters({});
        setSortOption(DEFAULT_SORT);
        setPage(0);
    };

    const handleSortChange = (value: string) => {
        setPage(0);
        setSortOption(value as SortOption);
    };

    const isAnyFilterActive =
        isDateFilterActive ||
        !!appliedSearch ||
        tierFilter !== ALL_VALUE ||
        leadStatusFilter !== ALL_ACTIVE_VALUE ||
        Object.values(cfFilters).some((v) => !!v) ||
        sortOption !== DEFAULT_SORT;

    const { data: usersResponse, isLoading, error } = useCampaignUsers(leadsPayload);

    const allFieldIdsFromAllUsers = useMemo(() => {
        const allFieldIds = new Set<string>();

        if (customFields && customFields.length > 0) {
            customFields.forEach((campaignField: any) => {
                const fieldId =
                    campaignField.custom_field?.id ||
                    campaignField.id ||
                    campaignField._id ||
                    campaignField.field_id;
                if (fieldId) {
                    allFieldIds.add(fieldId);
                }
            });
        }

        if (usersResponse && usersResponse.content) {
            usersResponse.content.forEach((lead: any) => {
                const customValues = lead.custom_field_values || {};
                Object.keys(customValues).forEach((fieldId) => {
                    allFieldIds.add(fieldId);
                });
            });
        }

        // For OPT_OUT audiences always show the opted_out_from column
        if (isOptOut) {
            allFieldIds.add('opted_out_from');
        }

        return Array.from(allFieldIds);
    }, [customFields, usersResponse, isOptOut]);

    const campaignFieldsMap = useMemo(() => {
        const map = new Map<string, { name: string; key?: string }>();
        // Always seed system-level virtual fields before early return
        map.set('opted_out_from', { name: 'Opted Out From', key: 'opted_out_from' });
        if (!customFields || customFields.length === 0) {
            return map;
        }

        customFields.forEach((campaignField: any) => {
            const fieldId =
                campaignField.custom_field?.id ||
                campaignField.id ||
                campaignField._id ||
                campaignField.field_id;

            if (fieldId) {
                const meta = campaignField.custom_field || {};
                const fieldName =
                    meta.fieldName || meta.field_name || campaignField.field_name || '';
                const fieldKey = meta.fieldKey || meta.field_key || generateKeyFromName(fieldName);

                if (fieldName) {
                    map.set(fieldId, { name: fieldName, key: fieldKey });
                    map.set(fieldId.toLowerCase(), { name: fieldName, key: fieldKey });
                    map.set(fieldId.toUpperCase(), { name: fieldName, key: fieldKey });
                }
            }
        });
        return map;
    }, [customFields]);

    // Build field metadata map from API response (custom_field_metadata)
    const fieldMetadataMap = useMemo(() => {
        const map = new Map<
            string,
            { fieldName?: string; fieldKey?: string; fieldType?: string }
        >();
        if (!usersResponse?.content) return map;

        usersResponse.content.forEach((lead: any) => {
            const metadata = lead.custom_field_metadata;
            if (metadata && typeof metadata === 'object') {
                Object.entries(metadata).forEach(([fieldId, meta]: [string, any]) => {
                    if (!map.has(fieldId) && meta) {
                        map.set(fieldId, {
                            fieldName: meta.fieldName || meta.field_name,
                            fieldKey: meta.fieldKey || meta.field_key,
                            fieldType: meta.fieldType || meta.field_type,
                        });
                    }
                });
            }
        });
        return map;
    }, [usersResponse]);

    const handleDeleteLead = useCallback(
        async (responseId: string) => {
            if (!confirm('Delete this lead? This action cannot be undone.')) return;
            try {
                await deleteAudienceLead(responseId);
                toast.success('Lead deleted');
                queryClient.invalidateQueries({ queryKey: ['campaignUsers', campaignId] });
            } catch {
                toast.error('Failed to delete lead');
            }
        },
        [campaignId, queryClient]
    );

    // Lead-system gate + per-row score lookup. Audience leads are treated as
    // enquiries for the visibility flag; leads without a linked user_id render
    // no badge (the lookup just returns undefined).
    const leadSettings = useLeadSettings();
    // Table-backed lead status catalog (colors for the Status chip).
    const { statuses: leadStatusCatalog } = useLeadStatuses();
    const leadStatusOptions = useMemo(
        () =>
            leadStatusCatalog.map((s) => ({
                key: s.status_key,
                label: s.label,
                color: s.color,
                order: s.display_order,
            })),
        [leadStatusCatalog]
    );
    const showLeadScore =
        !leadSettings.isLoading && leadSettings.enabled && leadSettings.showScoreInEnquiryTable;
    const leadUserIds = useMemo(
        () =>
            (usersResponse?.content ?? [])
                .map((lead: any) => lead.user?.id || lead.user_id || '')
                .filter((id: string): id is string => !!id),
        [usersResponse]
    );
    const { profiles: leadProfiles } = useLeadProfiles(leadUserIds, showLeadScore);
    const profilesForColumns = showLeadScore ? leadProfiles : undefined;

    // Counsellor + Notes columns rely on lead profile data (counselor name) and
    // a batch-fetched latest-note summary. Both queries skip themselves when
    // the lead system is off, so the table degrades gracefully.
    const counsellorProfiles = useLeadProfiles(leadUserIds, !leadSettings.isLoading && leadSettings.enabled);
    const { notesByUserId } = useLatestNotesBatch(
        leadUserIds,
        !leadSettings.isLoading && leadSettings.enabled
    );
    const showLeadOps = !leadSettings.isLoading && leadSettings.enabled;

    // Open-state for the two dialogs anchored at the table level so a single
    // mount handles every row's "Assign / Add Note" click.
    const [noteTarget, setNoteTarget] = useState<{ userId: string; userName: string } | null>(
        null
    );
    const [counsellorTarget, setCounsellorTarget] = useState<
        { userId: string; userName: string } | null
    >(null);

    const handleAddNote = useCallback((userId: string, userName: string) => {
        setNoteTarget({ userId, userName });
    }, []);
    const handleAssignCounsellor = useCallback((userId: string, userName: string) => {
        setCounsellorTarget({ userId, userName });
    }, []);

    const buildColumns = useCallback(
        (
            onRowClick?: (row: CampaignUserTable) => void,
            onSelectRow?: (row: CampaignUserTable) => void
        ) => {
            const allCustomFieldsArray = allFieldIdsFromAllUsers.map((fieldId) => ({
                id: fieldId,
                _id: fieldId,
                field_id: fieldId,
            }));

            if (allCustomFieldsArray.length === 0 && customFields.length === 0) {
                // No custom fields — always show Name, Email, Phone, Opted Out From
                const defaultFields = [
                    { id: 'full_name', _id: 'full_name', field_id: 'full_name' },
                    { id: 'email', _id: 'email', field_id: 'email' },
                    { id: 'phone_number', _id: 'phone_number', field_id: 'phone_number' },
                    { id: 'opted_out_from', _id: 'opted_out_from', field_id: 'opted_out_from' },
                ];
                const defaultFieldsMap = new Map<string, { name: string; key: string }>([
                    ['full_name', { name: 'Full Name', key: 'full_name' }],
                    ['email', { name: 'Email', key: 'email' }],
                    ['phone_number', { name: 'Phone Number', key: 'phone_number' }],
                    ['opted_out_from', { name: 'Opted Out From', key: 'opted_out_from' }],
                ]);
                return generateDynamicColumns(
                    defaultFields,
                    customFieldMap,
                    handleDeleteLead,
                    defaultFieldsMap,
                    fieldMetadataMap,
                    onRowClick,
                    onSelectRow,
                    profilesForColumns ?? counsellorProfiles.profiles,
                    showLeadOps ? notesByUserId : undefined,
                    showLeadOps ? handleAddNote : undefined,
                    showLeadOps ? handleAssignCounsellor : undefined,
                    showLeadOps ? leadStatusOptions : undefined
                );
            }

            const fieldIdsToUse =
                allCustomFieldsArray.length > 0 ? allCustomFieldsArray : customFields;
            return generateDynamicColumns(
                fieldIdsToUse,
                customFieldMap,
                handleDeleteLead,
                campaignFieldsMap,
                fieldMetadataMap,
                onRowClick,
                onSelectRow,
                profilesForColumns ?? counsellorProfiles.profiles,
                showLeadOps ? notesByUserId : undefined,
                showLeadOps ? handleAddNote : undefined,
                showLeadOps ? handleAssignCounsellor : undefined,
                showLeadOps ? leadStatusOptions : undefined
            );
        },
        [
            customFields,
            allFieldIdsFromAllUsers,
            customFieldMap,
            handleDeleteLead,
            campaignFieldsMap,
            fieldMetadataMap,
            profilesForColumns,
            counsellorProfiles.profiles,
            notesByUserId,
            showLeadOps,
            handleAddNote,
            handleAssignCounsellor,
            leadStatusOptions,
        ]
    );

    const tableKey = useMemo(() => {
        const fieldIdsKey =
            allFieldIdsFromAllUsers.length > 0
                ? allFieldIdsFromAllUsers.sort().join('-')
                : 'default';
        return `campaign-users-table-${campaignId}-${fieldIdsKey}`;
    }, [campaignId, allFieldIdsFromAllUsers]);

    const tableData = useMemo(() => {
        if (!usersResponse || !usersResponse.content || usersResponse.content.length === 0) {
            return undefined;
        }

        return {
            content: usersResponse.content.map((lead, index) => {
                const user = lead.user || {};
                const customValues = lead.custom_field_values || {};
                const submittedAt = lead.submitted_at_local
                    ? convertToLocalDateTime(lead.submitted_at_local)
                    : '-';

                const rowData: any = {
                    id: lead.response_id || lead.user_id || `${index}`,
                    submittedAt,
                    index: page * pageSize + index,
                    // Always populate basic user info so fallback columns work
                    // when the audience has no custom fields (e.g. opt-out audience)
                    full_name: user.full_name || (user as any).name || lead.parent_name || null,
                    email: user.email || lead.parent_email || null,
                    phone_number: user.mobile_number || lead.parent_mobile || null,
                    opted_out_from: lead.source_audience_name || null,
                    // Pass the underlying user reference through so the side-view click
                    // handler can map this lead to a StudentTable shape.
                    _user_id: (user as any).id || lead.user_id || null,
                    _user: user,
                    _custom_field_values: (lead as any).custom_field_values || {},
                    _audience_campaign_name: (lead as any).campaign_name || null,
                    // TAT / follow-up SLA badge (visual only)
                    _tat_overdue: (lead as any).tat_overdue ?? null,
                    _tat_due_soon: (lead as any).tat_due_soon ?? null,
                    _follow_up_overdue: (lead as any).follow_up_overdue ?? null,
                    // Custom pipeline status (enquiry_status)
                    _lead_status: (lead as any).lead_status ?? null,
                };

                // Enriched per-field response data (with type metadata) so the
                // side-view's LeadFormResponseCard can render dropdown answers
                // as plain text and multi-select / file answers correctly.
                const responseFields: Array<{
                    id: string;
                    name: string;
                    type: string;
                    rawValue: string | null;
                }> = [];
                Object.entries(customValues).forEach(([fieldId, rawVal]) => {
                    const value = rawVal == null ? null : String(rawVal);
                    if (value === null || value === '') return;
                    let name = fieldId;
                    let type = 'textfield';

                    const cfMapEntry = campaignFieldsMap.get(fieldId);
                    if (cfMapEntry?.name) name = cfMapEntry.name;

                    const setupEntry =
                        customFieldMap.get(fieldId) || customFieldMap.get(fieldId.toLowerCase());
                    if (setupEntry?.field_name) name = setupEntry.field_name;
                    if (setupEntry?.field_type) type = setupEntry.field_type;

                    const apiMeta = fieldMetadataMap.get(fieldId);
                    if (apiMeta?.fieldName) name = apiMeta.fieldName;
                    if (apiMeta?.fieldType) type = apiMeta.fieldType;

                    responseFields.push({ id: fieldId, name, type, rawValue: value });
                });
                rowData._response_fields = responseFields;

                allFieldIdsFromAllUsers.forEach((fieldId) => {
                    // Virtual fields are already set in rowData above — skip them
                    if (
                        fieldId === 'opted_out_from' ||
                        fieldId === 'full_name' ||
                        fieldId === 'email' ||
                        fieldId === 'phone_number'
                    )
                        return;

                    let fieldInfo =
                        customFieldMap.get(fieldId) ||
                        customFieldMap.get(fieldId.toLowerCase()) ||
                        customFieldMap.get(fieldId.toUpperCase()) ||
                        customFieldMap.get(fieldId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());

                    if (!fieldInfo && customFieldMap.size > 0) {
                        for (const [key, field] of customFieldMap.entries()) {
                            const customFieldId = field.custom_field_id?.toLowerCase();
                            const fieldKey = field.field_key?.toLowerCase();
                            const searchId = fieldId.toLowerCase();

                            if (
                                customFieldId === searchId ||
                                fieldKey === searchId ||
                                customFieldId?.replace(/[^a-zA-Z0-9]/g, '') ===
                                    searchId.replace(/[^a-zA-Z0-9]/g, '') ||
                                fieldKey?.replace(/[^a-zA-Z0-9]/g, '') ===
                                    searchId.replace(/[^a-zA-Z0-9]/g, '')
                            ) {
                                fieldInfo = field;
                                break;
                            }
                        }
                    }

                    let value: any = customValues[fieldId];

                    // If direct lookup by fieldId failed, try alternative keys
                    // from custom_field_values (handles cases where data is stored
                    // under field_key/field_name instead of UUID, or vice-versa)
                    if (value === undefined || value === null || value === '') {
                        if (fieldInfo) {
                            if (fieldInfo.field_key && customValues[fieldInfo.field_key]) {
                                value = customValues[fieldInfo.field_key];
                            }
                            if (
                                (value === undefined || value === null || value === '') &&
                                fieldInfo.custom_field_id &&
                                fieldInfo.custom_field_id !== fieldId &&
                                customValues[fieldInfo.custom_field_id]
                            ) {
                                value = customValues[fieldInfo.custom_field_id];
                            }
                            if (
                                (value === undefined || value === null || value === '') &&
                                fieldInfo.field_name
                            ) {
                                value =
                                    customValues[fieldInfo.field_name] ||
                                    customValues[fieldInfo.field_name.toLowerCase()];
                            }
                        }
                    }

                    // Fallback to user object properties
                    if (value === undefined || value === null || value === '') {
                        if (fieldInfo && fieldInfo.field_key) {
                            const fieldKey = fieldInfo.field_key;
                            value = (user as any)[fieldKey];

                            if (value === undefined || value === null) {
                                if (fieldKey === 'phone_number' && user.mobile_number) {
                                    value = user.mobile_number;
                                } else if (fieldKey === 'phone' && user.mobile_number) {
                                    value = user.mobile_number;
                                } else if (fieldKey === 'full_name' && user.full_name) {
                                    value = user.full_name;
                                } else if (fieldKey === 'email' && user.email) {
                                    value = user.email;
                                }
                            }
                        } else {
                            if (fieldId === 'full_name' || fieldId === 'name') {
                                value = user.full_name || (user as any).name;
                            } else if (fieldId === 'email') {
                                value = user.email;
                            }
                        }
                    }

                    rowData[fieldId] =
                        value !== undefined && value !== null && value !== '' ? value : null;
                });

                return rowData as CampaignUserTable;
            }),
            total_pages: usersResponse.totalPages,
            page_no: usersResponse.number,
            page_size: usersResponse.size,
            total_elements: usersResponse.totalElements,
            last: usersResponse.last,
        };
    }, [usersResponse, allFieldIdsFromAllUsers, customFieldMap, page, pageSize]);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    const handleDownload = async () => {
        if (!tableData?.total_elements) return;

        try {
            setIsDownloading(true);
            toast.info('Starting download...');

            const allDataPayload = {
                ...leadsPayload,
                page: 0,
                size: tableData.total_elements,
            };

            const response = await fetchCampaignLeads(allDataPayload);

            if (!response.content || response.content.length === 0) {
                toast.error('No data to download');
                setIsDownloading(false);
                return;
            }

            // Batch-resolve counsellor + latest-note data for the full export
            // set so the CSV mirrors what the table shows. We fetch only when
            // the lead system is enabled (otherwise the columns degrade to —).
            const exportUserIds = Array.from(
                new Set(
                    response.content
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
            if (showLeadOps && exportUserIds.length > 0) {
                try {
                    [exportProfiles, exportNotes] = await Promise.all([
                        fetchBatchProfiles(exportUserIds),
                        fetchLatestNotesBatch(exportUserIds),
                    ]);
                } catch (e) {
                    // Non-fatal — export proceeds with empty counsellor/note columns.
                    console.warn('Failed to enrich CSV with counsellor/notes', e);
                }
            }

            const allFieldIds = new Set<string>();
            customFields.forEach((field: any) => {
                const fieldId = field.custom_field?.id || field.id || field._id || field.field_id;
                if (fieldId) allFieldIds.add(fieldId);
            });
            response.content.forEach((lead: any) => {
                const customValues = lead.custom_field_values || {};
                Object.keys(customValues).forEach((key) => allFieldIds.add(key));
            });

            const fieldIdsArray = Array.from(allFieldIds);

            const csvHeaders = ['Lead ID', 'Submitted At', 'Name', 'Email', 'Mobile'];
            const fieldIdToHeaderNameMap: Record<string, string> = {};

            fieldIdsArray.forEach((fieldId) => {
                let headerName = fieldId;
                let fieldInfo =
                    customFieldMap.get(fieldId) ||
                    customFieldMap.get(fieldId.toLowerCase()) ||
                    customFieldMap.get(fieldId.toUpperCase()) ||
                    customFieldMap.get(fieldId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());

                if (!fieldInfo && customFieldMap.size > 0) {
                    for (const [key, field] of customFieldMap.entries()) {
                        const customFieldId = field.custom_field_id?.toLowerCase();
                        const fieldKey = field.field_key?.toLowerCase();
                        const searchId = fieldId.toLowerCase();

                        if (
                            customFieldId === searchId ||
                            fieldKey === searchId ||
                            customFieldId?.replace(/[^a-zA-Z0-9]/g, '') ===
                                searchId.replace(/[^a-zA-Z0-9]/g, '') ||
                            fieldKey?.replace(/[^a-zA-Z0-9]/g, '') ===
                                searchId.replace(/[^a-zA-Z0-9]/g, '')
                        ) {
                            fieldInfo = field;
                            break;
                        }
                    }
                }

                if (fieldInfo && fieldInfo.field_name) {
                    headerName = fieldInfo.field_name;
                } else if (campaignFieldsMap.has(fieldId)) {
                    headerName = campaignFieldsMap.get(fieldId)?.name || fieldId;
                }

                if (headerName.includes(',')) headerName = `"${headerName}"`;

                fieldIdToHeaderNameMap[fieldId] = headerName;
                csvHeaders.push(headerName);
            });

            // Mirror the table's added columns at the end of the CSV. Notes
            // collapse into one multi-line cell. The leading label is the
            // event's own type (Note / Call Log / Follow Up / Meeting / etc.),
            // not a hard-coded "Notes":
            //   1. {Type} - {description}
            //      updatedby - {actor}
            //      date - {date}
            //   2. {Type} - ...
            csvHeaders.push('Counsellor', 'Activity & Notes', 'Notes Count');

            const csvRows = response.content.map((lead) => {
                const user = lead.user || {};
                const customValues = lead.custom_field_values || {};
                const submittedAt = lead.submitted_at_local
                    ? convertToLocalDateTime(lead.submitted_at_local)
                    : '-';

                const safeString = (val: any) => {
                    if (val === undefined || val === null) return '';
                    const str = String(val);
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                };

                const row = [
                    safeString(lead.response_id || lead.user_id || '-'),
                    safeString(submittedAt),
                    safeString(user.full_name || (user as any).name || '-'),
                    safeString(user.email || '-'),
                    safeString(user.mobile_number || '-'),
                ];

                fieldIdsArray.forEach((fieldId) => {
                    let value: any = customValues[fieldId];
                    if (value === undefined || value === null || value === '') {
                        const fieldInfo =
                            customFieldMap.get(fieldId) ||
                            customFieldMap.get(fieldId.toLowerCase());

                        // Try alternative keys in custom_field_values
                        if (fieldInfo) {
                            if (fieldInfo.field_key && customValues[fieldInfo.field_key]) {
                                value = customValues[fieldInfo.field_key];
                            }
                            if (
                                (value === undefined || value === null || value === '') &&
                                fieldInfo.custom_field_id &&
                                fieldInfo.custom_field_id !== fieldId &&
                                customValues[fieldInfo.custom_field_id]
                            ) {
                                value = customValues[fieldInfo.custom_field_id];
                            }
                            if (
                                (value === undefined || value === null || value === '') &&
                                fieldInfo.field_name
                            ) {
                                value =
                                    customValues[fieldInfo.field_name] ||
                                    customValues[fieldInfo.field_name.toLowerCase()];
                            }
                        }

                        // Fallback to user object properties
                        if (
                            (value === undefined || value === null || value === '') &&
                            fieldInfo &&
                            fieldInfo.field_key
                        ) {
                            const k = fieldInfo.field_key;
                            if (k === 'email') value = user.email;
                            else if (k === 'phone' || k === 'phone_number')
                                value = user.mobile_number;
                            else if (k === 'full_name' || k === 'name') value = user.full_name;
                            else value = (user as any)[k];
                        }
                    }
                    row.push(safeString(value));
                });

                // Counsellor + Notes — mirror the table's two extra columns.
                const userIdForLookup =
                    (user as any).id || (lead as any).user_id || '';
                const counsellorName = userIdForLookup
                    ? exportProfiles[userIdForLookup]?.assigned_counselor_name ?? ''
                    : '';
                const noteSummary = userIdForLookup ? exportNotes[userIdForLookup] : undefined;
                const recent = noteSummary?.recent ?? [];
                const notesBlock = recent
                    .map((n, idx) => {
                        // Label comes from the event itself (Note / Call Log /
                        // Follow Up / Meeting) so the CSV faithfully mirrors
                        // what the side view shows for each entry.
                        const label = n.title?.trim() || 'Note';
                        const body = n.description?.trim() || '';
                        const date = n.created_at
                            ? convertToLocalDateTime(n.created_at)
                            : '';
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
                return row.join(',');
            });

            const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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

            toast.success('Download completed successfully');
        } catch (error) {
            console.error('Download failed:', error);
            toast.error('Failed to download data');
        } finally {
            setIsDownloading(false);
        }
    };

    if (isLoading || isCustomFieldsLoading) {
        return (
            <div className="flex w-full flex-col items-center gap-4 py-12">
                <DashboardLoader />
                <p className="animate-pulse text-sm text-neutral-500">Loading campaign users...</p>
            </div>
        );
    }

    if (error || customFieldsError) {
        return (
            <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-2">
                <p className="text-red-500">Error loading campaign users</p>
            </div>
        );
    }

    // Only short-circuit to the dedicated empty page when there's no data AND
    // no filters are applied. If the user has any filter or sort active, keep
    // the header + filter bar visible so they can clear/adjust without losing
    // their place.
    if ((!tableData || tableData.content.length === 0) && !isAnyFilterActive) {
        return (
            <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-2">
                <EmptyInvitePage />
                <p>No users enrolled in this campaign yet!</p>
            </div>
        );
    }

    return (
        <StudentSidebarProvider>
            <div className="flex w-full flex-col gap-6">
                {campaignName && (
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-h3 font-semibold">{campaignName}</h2>
                            <p className="mt-1 text-sm text-neutral-600">
                                Total Users:{' '}
                                <span className="font-semibold">
                                    {tableData?.total_elements ?? 0}
                                </span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {!isOptOut && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        navigate({
                                            to: '/audience-manager/list/campaign-users/add' as any,
                                            search: {
                                                campaignId,
                                                campaignName,
                                                customFields: customFieldsJson,
                                            } as any,
                                        } as any)
                                    }
                                >
                                    <UserPlus className="mr-2 size-4" />
                                    Add Response
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowSendMessageDialog(true)}
                            >
                                <MessageSquare className="mr-2 size-4" />
                                Send Message
                            </Button>
                            {!isOptOut && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowBulkImportDialog(true)}
                                >
                                    <Upload className="mr-2 size-4" />
                                    Import CSV
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownload}
                                disabled={isDownloading || !tableData?.total_elements}
                            >
                                <Download className="mr-2 size-4" />
                                {isDownloading ? 'Downloading...' : 'Download CSV'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Filter bar — search, tier, dropdown fields, dates */}
                <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
                    <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
                        <Label htmlFor="campaign-users-search" className="text-xs text-neutral-600">
                            Search
                        </Label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Input
                                id="campaign-users-search"
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
                        <Label htmlFor="campaign-users-tier" className="text-xs text-neutral-600">
                            Lead tier
                        </Label>
                        <div className="relative">
                            <Flame className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Select value={tierFilter} onValueChange={handleTierChange}>
                                <SelectTrigger id="campaign-users-tier" className="w-44 pl-7">
                                    <SelectValue placeholder="All tiers" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_VALUE}>All tiers</SelectItem>
                                    <SelectItem value="HOT">Hot</SelectItem>
                                    <SelectItem value="WARM">Warm</SelectItem>
                                    <SelectItem value="COLD">Cold</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label
                            htmlFor="campaign-users-lead-status"
                            className="text-xs text-neutral-600"
                        >
                            Lead status
                        </Label>
                        <div className="relative">
                            <CheckCircle2 className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Select
                                value={leadStatusFilter}
                                onValueChange={handleLeadStatusFilterChange}
                            >
                                <SelectTrigger id="campaign-users-lead-status" className="w-48 pl-7">
                                    <SelectValue placeholder="Active leads" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_ACTIVE_VALUE}>Active leads</SelectItem>
                                    <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                                    {leadStatusCatalog.map((s) => (
                                        <SelectItem key={s.id} value={s.status_key}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="campaign-users-sort" className="text-xs text-neutral-600">
                            Sort by
                        </Label>
                        <div className="relative">
                            <ArrowUpDown className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Select value={sortOption} onValueChange={handleSortChange}>
                                <SelectTrigger id="campaign-users-sort" className="w-56 pl-7">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                                        <SelectItem key={opt} value={opt}>
                                            {SORT_LABELS[opt]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {dropdownFilterFields.map((field) => {
                        const value = cfFilters[field.id] ?? ALL_VALUE;
                        return (
                            <div className="flex flex-col gap-1" key={field.id}>
                                <Label
                                    htmlFor={`campaign-users-cf-${field.id}`}
                                    className="text-xs text-neutral-600"
                                >
                                    {field.name}
                                </Label>
                                <Select
                                    value={value}
                                    onValueChange={(v) => handleCfFilterChange(field.id, v)}
                                >
                                    <SelectTrigger
                                        id={`campaign-users-cf-${field.id}`}
                                        className="w-44"
                                    >
                                        <SelectValue placeholder={`All ${field.name}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL_VALUE}>All {field.name}</SelectItem>
                                        {field.options.map((opt) => (
                                            <SelectItem key={opt} value={opt}>
                                                {opt}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        );
                    })}
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="campaign-users-from" className="text-xs text-neutral-600">
                            Submitted From
                        </Label>
                        <div className="relative">
                            <Calendar className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Input
                                id="campaign-users-from"
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="w-44 pl-7"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="campaign-users-to" className="text-xs text-neutral-600">
                            Submitted To
                        </Label>
                        <div className="relative">
                            <Calendar className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Input
                                id="campaign-users-to"
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="w-44 pl-7"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleApplyDateFilter}>
                            Apply
                        </Button>
                        {isAnyFilterActive && (
                            <Button size="sm" variant="ghost" onClick={handleClearAllFilters}>
                                Clear
                            </Button>
                        )}
                    </div>
                </div>

                {tableData && tableData.content.length > 0 ? (
                    <CampaignUsersTableBody
                        tableData={tableData}
                        tableKey={tableKey}
                        buildColumns={buildColumns}
                        isLoading={isLoading || isCustomFieldsLoading}
                        error={error || customFieldsError}
                        currentPage={page}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200 bg-white py-12 shadow-sm">
                        <p className="text-sm text-neutral-500">
                            {isAnyFilterActive
                                ? 'No responses match the current filters.'
                                : 'No responses yet for this campaign.'}
                        </p>
                        {isAnyFilterActive && (
                            <Button size="sm" variant="ghost" onClick={handleClearAllFilters}>
                                Clear filters
                            </Button>
                        )}
                    </div>
                )}

                {tableData && tableData.total_pages > 1 && (
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handlePageChange(Math.max(0, page - 1))}
                                    disabled={page === 0}
                                >
                                    <span className="sr-only">Previous</span>
                                    <ChevronLeft className="size-4" />
                                </Button>
                            </PaginationItem>
                            <PaginationItem className="hidden sm:block">
                                <span className="px-4 text-sm text-muted-foreground">
                                    Page {page + 1} of {tableData.total_pages}
                                </span>
                            </PaginationItem>
                            <PaginationItem>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() =>
                                        handlePageChange(
                                            Math.min(tableData.total_pages - 1, page + 1)
                                        )
                                    }
                                    disabled={page >= tableData.total_pages - 1}
                                >
                                    <span className="sr-only">Next</span>
                                    <ChevronRight className="size-4" />
                                </Button>
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                )}

                <CommunicationHistory campaignId={campaignId} />

                <LeadBulkImportDialog
                    open={showBulkImportDialog}
                    onOpenChange={setShowBulkImportDialog}
                    campaignId={campaignId}
                    campaignName={campaignName || 'Campaign'}
                    instituteId={instituteId || ''}
                    customFields={bulkImportCustomFields}
                />

                <SendMessageDialog
                    open={showSendMessageDialog}
                    onOpenChange={setShowSendMessageDialog}
                    campaignId={campaignId}
                    campaignName={campaignName || 'Campaign'}
                    instituteId={instituteId || ''}
                    customFields={bulkImportCustomFields}
                    leadCount={tableData?.total_elements || 0}
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
            </div>
        </StudentSidebarProvider>
    );
};

// Map a lead row from the campaign-users table to a partial StudentTable so the
// shared StudentSidebar can render its tabs against this audience respondent.
// Underscore-prefixed extras (`_response_fields`, `_audience_campaign_name`)
// are attached for the LeadFormResponseCard to read from the side view.
const mapLeadToStudent = (row: CampaignUserTable): StudentTable => {
    const u = row._user ?? {};
    const customFields: Record<string, string | null> = {};
    const cfv = row._custom_field_values ?? {};
    for (const [k, v] of Object.entries(cfv)) {
        customFields[k] = v == null ? null : String(v);
    }
    const result: StudentTable = {
        id: u.id || row._user_id || row.id,
        user_id: u.id || row._user_id || row.id,
        full_name: (row.full_name as string) || u.full_name || '',
        email: (row.email as string) || u.email || '',
        username: u.username ?? null,
        mobile_number: (row.phone_number as string) || u.mobile_number || '',
        gender: u.gender || '',
        region: u.region ?? null,
        city: u.city || '',
        date_of_birth: u.date_of_birth || '',
        created_at: '',
        address_line: u.address_line || '',
        attendance_percent: 0,
        referral_count: 0,
        pin_code: u.pin_code || '',
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
        face_file_id: u.face_file_id ?? u.profile_pic_file_id ?? null,
        parents_email: '',
        parents_mobile_number: '',
        parents_to_mother_email: '',
        parents_to_mother_mobile_number: '',
        destination_package_session_id: '',
        enroll_invite_id: '',
        payment_status: '',
        custom_fields: customFields,
    };
    // Attach the side-view extras via a loose cast — these aren't part of the
    // canonical StudentTable shape, only read by LeadFormResponseCard.
    (result as unknown as Record<string, unknown>)._response_fields = row._response_fields;
    (result as unknown as Record<string, unknown>)._audience_campaign_name =
        row._audience_campaign_name;
    return result;
};

interface CampaignUsersTableBodyProps {
    tableData: {
        content: CampaignUserTable[];
        total_pages: number;
        page_no: number;
        page_size: number;
        total_elements: number;
        last: boolean;
    };
    tableKey: string;
    buildColumns: (
        onRowClick?: (row: CampaignUserTable) => void,
        onSelectRow?: (row: CampaignUserTable) => void
    ) => ColumnDef<CampaignUserTable>[];
    isLoading: boolean;
    error: unknown;
    currentPage: number;
}

// Inner body component: lives inside StudentSidebarProvider so it can read/set
// the selected respondent, and creates its own SidebarProvider so the side view
// opens beside the table when a row is clicked.
const CampaignUsersTableBody = ({
    tableData,
    tableKey,
    buildColumns,
    isLoading,
    error,
    currentPage,
}: CampaignUsersTableBodyProps) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { setSelectedStudent } = useStudentSidebar();

    // Cell-text click: select + ensure the sidebar is open.
    const handleRowClick = useCallback(
        (row: CampaignUserTable) => {
            setSelectedStudent(mapLeadToStudent(row));
            setIsSidebarOpen(true);
        },
        [setSelectedStudent]
    );

    // Details-icon click: only update the selected row. The SidebarTrigger
    // wrapping the icon handles the open/close toggle, mirroring the contacts
    // and students-list pattern so behaviour stays consistent across tables.
    const handleSelectRow = useCallback(
        (row: CampaignUserTable) => {
            setSelectedStudent(mapLeadToStudent(row));
        },
        [setSelectedStudent]
    );

    const columns = useMemo(
        () => buildColumns(handleRowClick, handleSelectRow),
        [buildColumns, handleRowClick, handleSelectRow]
    );

    return (
        <div className="rounded-md shadow-sm">
            <SidebarProvider
                style={{ ['--sidebar-width' as string]: '565px' }}
                defaultOpen={false}
                open={isSidebarOpen}
                onOpenChange={setIsSidebarOpen}
            >
                <MyTable<CampaignUserTable>
                    key={tableKey}
                    data={tableData}
                    columns={columns}
                    isLoading={isLoading}
                    error={error}
                    currentPage={currentPage}
                    tableState={{ columnVisibility: {} }}
                />
                <div>
                    <StudentSidebar selectedTab="overview" examType="EXAM" isStudentList={false} />
                </div>
            </SidebarProvider>
        </div>
    );
};
