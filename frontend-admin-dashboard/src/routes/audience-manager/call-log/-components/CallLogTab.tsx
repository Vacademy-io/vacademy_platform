/**
 * CallLogTab — the "Call Log" tab of the Reports Center
 * (/audience-manager/reports?tab=call-log). The operational, row-level call
 * list that the aggregate "Calling" tab drills into: every call (AI + human,
 * inbound + outbound, every provider) in one paginated, filterable table.
 *
 * Lazy-imported by the Reports shell; the shell owns the page chrome + the
 * shared filter bar (date range / team / counsellor) and passes the applied
 * window in via props (contract-fixed default export + ReportTabProps).
 *
 * Sections (top to bottom):
 *   1. KPI strip — total · connected · connect-rate · talk-time · AI vs human,
 *      from POST /metrics (honors the same filters as the table).
 *   2. Worklist chips — Missed inbound · Callbacks due (badge counts), plus the
 *      tab-local filter bar (status / direction / type / provider / disposition
 *      / number / lead name / has-recording).
 *   3. Paginated call table — status pill, AI/human badge, inline recording
 *      playback, and a per-row quick-disposition that syncs lead status. Admins
 *      additionally get a per-row health dot opening the technical post-mortem
 *      for AI calls (see ./CallHealth.tsx).
 *   4. Export — CSV / XLSX of the current filtered view (server-rendered).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
    ArrowsClockwise,
    DownloadSimple,
    Info,
    PhoneIncoming,
    PhoneOutgoing,
    Robot,
    Sparkle,
    User,
    WarningCircle,
    Waveform,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyPagination } from '@/components/design-system/pagination';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { SidebarProvider } from '@/components/ui/sidebar';
import { isAdminForInstitute } from '@/lib/auth/roleUtils';
import { CallIntelligencePanel, useCallIntelligenceEnabled } from '@/components/shared/leads';
import { MultiSelectFilter } from '@/components/shared/leads/multi-select-filter';
import { ToolCostConfirmDialog } from '@/components/common/ai-credits/ToolCostConfirmDialog';
import { fetchCreditEstimate } from '@/services/ai-credits/get-ai-credits';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { StudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-side-view';
import { fetchStudentDetailsOnce } from '@/services/get-student-details';
import {
    audienceLeadKey,
    fetchAudienceLeadByResponseId,
} from '@/routes/audience-manager/list/-services/get-recent-leads';
import { mapRecentLeadToStudent } from '@/components/shared/leads/lead-view-model';
import type { StudentTable } from '@/types/student-table-types';
import { TELEPHONY_CALL_STATUSES, humanizeCallStatus } from '@/hooks/use-lead-report-settings';
import {
    applyDisposition,
    callDetailKey,
    callRowLeadUserId,
    isMaskedNumber,
    callLogMetricsKey,
    callLogSearchKey,
    dispositionCatalogKey,
    dispositionOptionsKey,
    exportCallLog,
    fetchCallDetail,
    fetchCallLog,
    fetchCallMetrics,
    fetchDispositionCatalog,
    fetchDispositionFilterOptions,
    fetchRecordingUrl,
    isCallLogEndpointMissing,
    normalizeDispositionKey,
    rowCallHealth,
    toMillis,
    type CallLogFilters,
    type CallLogScope,
    type CallRow,
    type DispositionOption,
} from '../-services/call-log-service';
import { CallHealthCell, CallHealthSheet } from './CallHealth';

/** Scope passed in by the page (date window + RBAC narrowing), same shape the Reports tabs used. */
export interface CallLogTabProps {
    instituteId: string;
    fromDate: string;
    toDate: string;
    teamId?: string;
    counsellorUserId?: string;
}

const PAGE_SIZE = 25;
const ALL = '__ALL__';

/** Provider filter/label vocabulary — labels come from the translation catalog. */
function buildProviderOptions(t: TFunction) {
    return [
        { value: 'EXOTEL', label: t('providers.exotel') },
        { value: 'AAVTAAR', label: t('providers.aavtaarAi') },
        { value: 'AIRTEL', label: t('providers.airtel') },
    ] as const;
}

// ── Formatting ─────────────────────────────────────────────────────────────

function fmtNumber(n: number | null | undefined): string {
    return n == null || Number.isNaN(n) ? '—' : n.toLocaleString();
}
function fmtPct(p: number | null | undefined): string {
    return p == null || Number.isNaN(p) ? '—' : `${p.toFixed(1)}%`;
}
function fmtTalkHm(seconds: number | null | undefined): string {
    if (seconds == null || Number.isNaN(seconds)) return '—';
    const total = Math.max(0, Math.round(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}`;
}
function fmtDuration(s: number | null): string {
    if (!s || s <= 0) return '—';
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m ? `${m}m ${r}s` : `${r}s`;
}
function fmtDateTime(v: number | string | null): string {
    const ms = toMillis(v);
    if (ms == null) return '—';
    return new Date(ms).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const STATUS_TONE: Record<string, string> = {
    COMPLETED: 'bg-success-50 text-success-700',
    NO_ANSWER: 'bg-warning-50 text-warning-700',
    BUSY: 'bg-warning-50 text-warning-700',
    FAILED: 'bg-danger-50 text-danger-600',
    CANCELLED: 'bg-neutral-100 text-neutral-600',
    IN_PROGRESS: 'bg-info-50 text-info-700',
    COUNSELLOR_RINGING: 'bg-info-50 text-info-700',
    COUNSELLOR_ANSWERED: 'bg-info-50 text-info-700',
    QUEUED: 'bg-neutral-100 text-neutral-600',
    INITIATED: 'bg-neutral-100 text-neutral-600',
};

/**
 * Statuses where a "why did it end this way" popover earns its place — the call
 * didn't simply connect and complete.
 */
const DETAILABLE_STATUSES = new Set(['FAILED', 'BUSY', 'NO_ANSWER', 'CANCELLED']);

/**
 * Whether the status pill doubles as a details affordance. Status alone used to
 * decide this, which meant a COMPLETED call could never be inspected — and most
 * AI calls complete, including the ones where the caller sat through 10s of
 * silence. A call that reported a technical verdict has something to say
 * regardless of how it ended, so it earns the affordance too.
 */
function isDetailable(row: CallRow): boolean {
    return DETAILABLE_STATUSES.has(row.status) || rowCallHealth(row) != null;
}

/**
 * The instant, row-only seed for the side-sheet — enough to open it on the right
 * person while the real lead record loads. `_response_id` marks the selection as
 * a lead so the Lead Profile tab opens. Cast through unknown because the full
 * StudentTable has ~90 fields the sheet lazy-loads.
 *
 * This is deliberately thin: a call row simply does not contain a lead. Its
 * `lead_name` is `audience_response.parent_name` — the GUARDIAN, a different
 * person (see the note in lead-view-model.ts) — it has no email, and its number
 * may be masked. Everything real arrives from the hydration in `openLead`.
 */
function callRowSeedStudent(r: CallRow): StudentTable {
    const userId = callRowLeadUserId(r);
    const student: Record<string, unknown> = {
        id: userId,
        user_id: userId,
        full_name: r.lead_name || '',
        email: '',
        // Never the masked string: it is display text, and the Communications tab
        // would query the timeline by it and the composer would message it.
        mobile_number: isMaskedNumber(r.lead_number) ? '' : r.lead_number ?? '',
        status: 'INACTIVE',
        _response_id: r.response_id ?? null,
    };
    return student as unknown as StudentTable;
}

// NOTE ON SCOPE: the masked-numbers setting governs the CALL LOG surface — this
// table, the CSV/XLSX export, the detail popover and the technical diagnostics.
// It deliberately does NOT follow the lead into the side-sheet, which hydrates and
// behaves exactly as it does when opened from Recent Leads / Lead List / Lead
// Board / Follow-ups. Two reasons:
//   1. it would be false assurance — the same number is shown unmasked on all four
//      of those pages, so masking one panel contains nothing;
//   2. the sheet's Overview tab seeds an EDIT form from `_response_fields`
//      (EditLeadDetails) and writes it back, so rewriting an answer for display
//      risks persisting `*******1234` into the lead's real phone field. Today that
//      is prevented only by EditLeadDetails filtering phone fields with a regex
//      identical to the one such a masking pass would use — a coincidence, not a
//      guarantee.
// Making the mask a real access control means applying it across every lead
// surface, which is a deliberate product decision, not a Call Log detail.

// ── Main component (contract-fixed export + props) ─────────────────────────

export default function CallLogTab({
    instituteId,
    fromDate,
    toDate,
    teamId,
    counsellorUserId,
}: CallLogTabProps) {
    const { t } = useTranslation('audienceManagerCallLogTab');
    const queryClient = useQueryClient();
    const scope: CallLogScope = { instituteId, fromDate, toDate, teamId, counsellorUserId };

    // Shared lead side-sheet (same one Recent Leads / Follow-ups use). The
    // StudentSidebarProvider is mounted app-wide by the layout; we only own the
    // open/close state, via a local SidebarProvider around the sheet.
    const { setSelectedStudent } = useStudentSidebar();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    /**
     * Open the lead behind a call row: seed the sheet from the row so it opens
     * instantly, then replace the selection with the real lead.
     *
     * The replacement is the whole point. The sheet is NOT purely user-id driven —
     * its header, quick-contact chips, Communications tab (queried by email/phone),
     * WhatsApp/email composer and the Lead Profile tab's form-response card all read
     * the selected object verbatim. A call row carries none of that, which is why
     * those surfaces came up blank when opened from here.
     *
     * Two hydration paths, preferring the richer one:
     *   1. the call is tied to an audience response → fetch that lead and run it
     *      through `mapRecentLeadToStudent`, the SAME mapper Recent Leads / Lead
     *      List / Follow-ups use, so the sheet gets an identical object (identity,
     *      form answers + field metadata, guardian rows, campaign name);
     *   2. no response id (a call linked to a person but to no campaign) → fall
     *      back to the auth-service user record for at least name/email/phone.
     * If both fail the row-derived seed stands.
     */
    const openLeadRef = useRef(0);
    const openLead = async (r: CallRow) => {
        const userId = callRowLeadUserId(r);
        if (!userId) return;
        const token = ++openLeadRef.current;
        setSelectedStudent(callRowSeedStudent(r), { openOverlay: false });
        setIsSidebarOpen(true);

        const apply = (student: StudentTable) => {
            // A newer row was clicked while this was in flight — its selection wins.
            if (openLeadRef.current !== token) return;
            // Hydration must never take away a name we already had: if the lead's
            // auth user couldn't be resolved the mapper yields an empty full_name,
            // and the header would fall back from the row's name to "Unknown".
            const named: StudentTable = student.full_name
                ? student
                : { ...student, full_name: r.lead_name || '' };
            setSelectedStudent(named, { openOverlay: false });
        };

        if (r.response_id) {
            try {
                const lead = await queryClient.fetchQuery({
                    queryKey: audienceLeadKey(r.response_id),
                    queryFn: () => fetchAudienceLeadByResponseId(r.response_id as string),
                    staleTime: 2 * 60 * 1000,
                });
                apply(mapRecentLeadToStudent(lead));
                return;
            } catch {
                // Older backend (no single-lead read) or a deleted response —
                // fall through to the user-record path rather than leaving the
                // sheet on the row seed.
            }
        }

        try {
            const details = await fetchStudentDetailsOnce(queryClient, userId);
            apply({
                ...callRowSeedStudent(r),
                full_name: details?.full_name || r.lead_name || '',
                email: details?.email || '',
                mobile_number: details?.mobile_number || '',
            } as StudentTable);
        } catch {
            // Keep the seed.
        }
    };

    // Per-call transcript + AI intelligence — hosted in a dialog, gated by a
    // credits-cost confirmation. Column only shows when the feature is enabled.
    const intelEnabled = useCallIntelligenceEnabled();
    const [intelTarget, setIntelTarget] = useState<CallRow | null>(null);

    // Per-call technical health (AI calls). Admin-only: the panel speaks in
    // internal failure language ("TTS socket wedge", "answers discarded"), which
    // is the right vocabulary for whoever debugs the agent and the wrong one for
    // a counsellor working their list. Same gate the rest of the admin-only
    // affordances use — the server re-checks on the detail endpoint.
    const canSeeCallHealth = isAdminForInstitute(instituteId);
    const [healthTarget, setHealthTarget] = useState<CallRow | null>(null);

    // Tab-local filters.
    const [direction, setDirection] = useState<string>(ALL);
    const [callType, setCallType] = useState<string>(ALL);
    const [providerType, setProviderType] = useState<string>(ALL);
    const [status, setStatus] = useState<string>(ALL);
    // Multi-select: the search endpoint takes a list, and "show me Callback OR
    // Callback Requested OR Demo Booked" is the normal way this vocabulary is used —
    // it has as many entries as the institute has AI outcomes, so one-at-a-time
    // means one page load per outcome.
    const [dispositionKeys, setDispositionKeys] = useState<string[]>([]);
    const [leadName, setLeadName] = useState('');
    const [toNumber, setToNumber] = useState('');
    const [chip, setChip] = useState<'NONE' | 'MISSED' | 'CALLBACKS'>('NONE');
    const [page, setPage] = useState(0);

    const filters: CallLogFilters = useMemo(
        () => ({
            direction: direction === ALL ? undefined : (direction as CallLogFilters['direction']),
            callType: callType === ALL ? undefined : (callType as CallLogFilters['callType']),
            providerType: providerType === ALL ? undefined : providerType,
            statuses: status === ALL ? undefined : [status],
            dispositionKeys: dispositionKeys.length ? dispositionKeys : undefined,
            leadName: leadName.trim() || undefined,
            toNumber: toNumber.trim() || undefined,
            missedInbound: chip === 'MISSED' || undefined,
            callbacksDue: chip === 'CALLBACKS' || undefined,
            sortBy: 'TIME',
            sortDirection: 'DESC',
        }),
        [direction, callType, providerType, status, dispositionKeys, leadName, toNumber, chip]
    );

    // Any filter / scope change resets to the first page.
    const filterSig = JSON.stringify([scope, filters]);
    useEffect(() => setPage(0), [filterSig]);

    const retryUnlessMissing = (failureCount: number, error: unknown) =>
        !isCallLogEndpointMissing(error) && failureCount < 2;

    // Two disposition vocabularies, deliberately: the catalog is what a counsellor may
    // SET (the apply endpoint accepts nothing else), while the filter must also offer
    // the AI outcomes — configured in Settings → AI Calling and by the institute's AI
    // agents — because that's what the Disposition column actually shows for AI calls.
    const catalogQuery = useQuery({
        queryKey: dispositionCatalogKey(instituteId),
        queryFn: () => fetchDispositionCatalog(instituteId),
        enabled: !!instituteId,
        staleTime: 5 * 60 * 1000,
        retry: retryUnlessMissing,
    });
    const dispositionOptionsQuery = useQuery({
        queryKey: dispositionOptionsKey(instituteId),
        queryFn: () => fetchDispositionFilterOptions(instituteId),
        enabled: !!instituteId,
        staleTime: 5 * 60 * 1000,
        retry: retryUnlessMissing,
    });
    const metricsQuery = useQuery({
        queryKey: callLogMetricsKey(scope, filters),
        queryFn: () => fetchCallMetrics(scope, filters),
        enabled: !!instituteId,
        staleTime: 30_000,
        retry: retryUnlessMissing,
    });
    const searchQuery = useQuery({
        queryKey: callLogSearchKey(scope, filters, page, PAGE_SIZE),
        queryFn: () => fetchCallLog(scope, filters, page, PAGE_SIZE),
        enabled: !!instituteId,
        staleTime: 15_000,
        retry: retryUnlessMissing,
    });

    const [dispositionTarget, setDispositionTarget] = useState<CallRow | null>(null);

    const refreshLists = () => {
        queryClient.invalidateQueries({ queryKey: ['crm-call-log-search'] });
        queryClient.invalidateQueries({ queryKey: ['crm-call-log-metrics'] });
    };

    if (!instituteId) {
        return <EmptyBlock message={t('empty.pickInstitute')} />;
    }
    if (searchQuery.isError && isCallLogEndpointMissing(searchQuery.error)) {
        return <DeployPendingNotice />;
    }

    const metrics = metricsQuery.data;
    // Picker options: catalog only, and defensively re-filtered — an older cached
    // response, or a backend that starts folding AI outcomes into /dispositions, must
    // never put an unsettable option in front of a counsellor.
    const dispositions = (catalogQuery.data ?? []).filter((d) => d.settable !== false);
    const dispositionOptions = dispositionOptionsQuery.data ?? dispositions;
    /** Normalized outcome key → the vocabulary's label, so a row reads like the filter. */
    const dispositionLabels = new Map(
        dispositionOptions.map((d) => [normalizeDispositionKey(d.disposition_key), d.label])
    );
    const data = searchQuery.data;
    const rows = data?.content ?? [];

    return (
        <SidebarProvider
            style={{ ['--sidebar-width' as string]: '565px' }}
            defaultOpen={false}
            open={isSidebarOpen}
            onOpenChange={setIsSidebarOpen}
        >
            <div className="flex w-full min-w-0 flex-col gap-6">
                {/* 1 — KPI strip */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                    <KpiStat
                        label={t('kpi.totalCalls')}
                        value={fmtNumber(metrics?.total_calls)}
                        tone="primary"
                        loading={metricsQuery.isLoading}
                    />
                    <KpiStat
                        label={t('kpi.connected')}
                        value={fmtNumber(metrics?.connected_calls)}
                        sub={fmtPct(metrics?.connect_rate)}
                        tone="success"
                        loading={metricsQuery.isLoading}
                    />
                    <KpiStat
                        label={t('kpi.talkTime')}
                        value={fmtTalkHm(metrics?.total_talk_seconds)}
                        sub={t('kpi.talkTimeUnit')}
                        tone="warning"
                        loading={metricsQuery.isLoading}
                    />
                    <KpiStat
                        label={t('kpi.uniqueLeads')}
                        value={fmtNumber(metrics?.unique_leads)}
                        tone="info"
                        loading={metricsQuery.isLoading}
                    />
                    <KpiStat
                        label={t('kpi.aiVsHuman')}
                        value={`${fmtNumber(metrics?.ai_calls)} / ${fmtNumber(metrics?.human_calls)}`}
                        sub={t('kpi.aiVsHumanUnit')}
                        tone="default"
                        loading={metricsQuery.isLoading}
                    />
                </div>

                {/* 2 — Worklist chips + filter bar */}
                <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <ChipToggle
                            active={chip === 'NONE'}
                            onClick={() => setChip('NONE')}
                            label={t('chips.allCalls')}
                        />
                        <ChipToggle
                            active={chip === 'MISSED'}
                            onClick={() => setChip(chip === 'MISSED' ? 'NONE' : 'MISSED')}
                            label={t('chips.missedInbound')}
                            count={metrics?.missed_inbound_due}
                            tone="danger"
                        />
                        <ChipToggle
                            active={chip === 'CALLBACKS'}
                            onClick={() => setChip(chip === 'CALLBACKS' ? 'NONE' : 'CALLBACKS')}
                            label={t('chips.callbacksDue')}
                            count={metrics?.callbacks_due}
                            tone="warning"
                        />
                        <div className="ml-auto flex items-center gap-2">
                            <ExportButton
                                scope={scope}
                                filters={filters}
                                disabled={rows.length === 0}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                        <FilterText
                            label={t('filters.leadName')}
                            value={leadName}
                            onChange={setLeadName}
                            placeholder={t('filters.leadNamePlaceholder')}
                        />
                        <FilterText
                            label={t('filters.number')}
                            value={toNumber}
                            onChange={setToNumber}
                            placeholder={t('filters.numberPlaceholder')}
                        />
                        <FilterSelect
                            label={t('filters.direction')}
                            value={direction}
                            onChange={setDirection}
                            options={[
                                { value: 'OUTBOUND', label: t('filters.directionOutbound') },
                                { value: 'INBOUND', label: t('filters.directionInbound') },
                            ]}
                        />
                        <FilterSelect
                            label={t('filters.type')}
                            value={callType}
                            onChange={setCallType}
                            options={[
                                { value: 'HUMAN', label: t('filters.typeHuman') },
                                { value: 'AI', label: t('filters.typeAi') },
                            ]}
                        />
                        <FilterSelect
                            label={t('filters.provider')}
                            value={providerType}
                            onChange={setProviderType}
                            options={buildProviderOptions(t).map((p) => ({
                                value: p.value,
                                label: p.label,
                            }))}
                        />
                        <FilterSelect
                            label={t('filters.status')}
                            value={status}
                            onChange={setStatus}
                            options={TELEPHONY_CALL_STATUSES.map((s) => ({
                                value: s,
                                label: humanizeCallStatus(s),
                            }))}
                        />
                        <FilterMultiSelect
                            label={t('filters.disposition')}
                            selected={dispositionKeys}
                            onChange={setDispositionKeys}
                            options={dispositionOptions.map((d) => ({
                                value: d.disposition_key,
                                label: d.label,
                            }))}
                        />
                    </div>
                </section>

                {/* 3 — Call table */}
                <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-neutral-900">
                            {t('table.heading')}
                            {data && (
                                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                                    {fmtNumber(data.total_elements)}
                                </span>
                            )}
                        </h2>
                    </div>

                    {searchQuery.isLoading ? (
                        <LoadingBlock />
                    ) : searchQuery.isError ? (
                        <ErrorNotice onRetry={() => searchQuery.refetch()} />
                    ) : rows.length === 0 ? (
                        <EmptyBlock message={t('table.empty')} />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                                            <th className="py-2 pe-3">{t('table.columns.time')}</th>
                                            <th className="py-2 pe-3">{t('table.columns.lead')}</th>
                                            <th className="py-2 pe-3">{t('table.columns.direction')}</th>
                                            <th className="py-2 pe-3">{t('table.columns.type')}</th>
                                            <th className="py-2 pe-3">{t('table.columns.status')}</th>
                                            {canSeeCallHealth && (
                                                <th
                                                    className="py-2 pr-3"
                                                    title={t('table.columns.healthTooltip')}
                                                >
                                                    {t('table.columns.health')}
                                                </th>
                                            )}
                                            <th className="py-2 pe-3 text-end">
                                                {t('table.columns.duration')}
                                            </th>
                                            <th className="py-2 pe-3">
                                                {t('table.columns.counsellor')}
                                            </th>
                                            <th className="py-2 pe-3">
                                                {t('table.columns.disposition')}
                                            </th>
                                            <th className="py-2 pe-3">
                                                {t('table.columns.recording')}
                                            </th>
                                            {intelEnabled && (
                                                <th className="py-2 pe-3">
                                                    {t('table.columns.ai')}
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r) => (
                                            <tr
                                                key={r.id}
                                                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                                            >
                                                <td className="whitespace-nowrap py-2.5 pr-3 text-neutral-600">
                                                    {fmtDateTime(r.start_time ?? r.created_at)}
                                                </td>
                                                <td className="py-2.5 pr-3">
                                                    <div className="flex flex-col">
                                                        {/* callRowLeadUserId, not `r.user_id`: unlinked
                                                        calls store the literal 'UNKNOWN', which is
                                                        truthy — those rows used to offer a profile
                                                        link that opened an empty sheet. */}
                                                        {callRowLeadUserId(r) ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => void openLead(r)}
                                                                className="w-fit text-left font-medium text-primary-600 hover:underline"
                                                                title={t('table.openLeadProfile')}
                                                            >
                                                                {r.lead_name || t('table.viewLead')}
                                                            </button>
                                                        ) : (
                                                            <span className="font-medium text-neutral-900">
                                                                {r.lead_name || '—'}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-neutral-500">
                                                            {r.lead_number || '—'}
                                                        </span>
                                                        {r.ivr_selection && (
                                                            <span
                                                                className="mt-1 inline-flex w-fit items-center rounded-sm bg-primary-50 px-2 py-0.5 text-caption font-medium text-primary-700"
                                                                title={t('table.ivrOptionChosen')}
                                                            >
                                                                {r.ivr_selection}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 pr-3">
                                                    <DirectionBadge direction={r.direction} />
                                                </td>
                                                <td className="py-2.5 pr-3">
                                                    <TypeBadge callType={r.call_type} />
                                                </td>
                                                <td className="py-2.5 pr-3">
                                                    <StatusCell instituteId={instituteId} row={r} />
                                                </td>
                                                {canSeeCallHealth && (
                                                    <td className="py-2.5 pr-3">
                                                        <CallHealthCell
                                                            instituteId={instituteId}
                                                            row={r}
                                                            onOpen={() => setHealthTarget(r)}
                                                        />
                                                    </td>
                                                )}
                                                <td className="py-2.5 pr-3 text-right text-neutral-700">
                                                    {fmtDuration(r.duration_seconds)}
                                                </td>
                                                <td className="py-2.5 pr-3 text-neutral-700">
                                                    {r.counsellor_name || '—'}
                                                </td>
                                                <td className="py-2.5 pr-3">
                                                    <DispositionCell
                                                        row={r}
                                                        labels={dispositionLabels}
                                                        onEdit={() => setDispositionTarget(r)}
                                                    />
                                                </td>
                                                <td className="py-2.5 pr-3">
                                                    <RecordingCell
                                                        instituteId={instituteId}
                                                        row={r}
                                                    />
                                                </td>
                                                {intelEnabled && (
                                                    <td className="py-2.5 pr-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => setIntelTarget(r)}
                                                            className="inline-flex items-center gap-1 rounded-md border border-primary-100 bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
                                                            title={t('intelligenceDialog.heading')}
                                                        >
                                                            <Sparkle size={14} weight="fill" />
                                                            {t('table.columns.ai')}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {data && data.total_pages > 1 && (
                                <MyPagination
                                    currentPage={page}
                                    totalPages={data.total_pages}
                                    onPageChange={setPage}
                                />
                            )}
                        </>
                    )}
                </section>

                {/* Quick-disposition dialog */}
                <DispositionDialog
                    instituteId={instituteId}
                    call={dispositionTarget}
                    options={dispositions}
                    onClose={() => setDispositionTarget(null)}
                    onApplied={() => {
                        setDispositionTarget(null);
                        refreshLists();
                    }}
                />

                {/* Transcript + AI intelligence dialog (credits-gated) */}
                <CallIntelligenceDialog call={intelTarget} onClose={() => setIntelTarget(null)} />

                {/* Call health — technical post-mortem side sheet (admin-only) */}
                {canSeeCallHealth && (
                    <CallHealthSheet
                        instituteId={instituteId}
                        call={healthTarget}
                        onClose={() => setHealthTarget(null)}
                    />
                )}
            </div>

            {/* Shared lead side-sheet — opens to the Lead Profile tab. */}
            <StudentSidebar defaultLeadProfile />
        </SidebarProvider>
    );
}

// ── Worklist chip ──────────────────────────────────────────────────────────

function ChipToggle({
    active,
    onClick,
    label,
    count,
    tone = 'neutral',
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    count?: number;
    tone?: 'neutral' | 'danger' | 'warning';
}) {
    const badgeTone =
        tone === 'danger'
            ? 'bg-danger-100 text-danger-700'
            : tone === 'warning'
              ? 'bg-warning-100 text-warning-700'
              : 'bg-neutral-200 text-neutral-700';
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                active
                    ? 'border-primary-500 bg-primary-50 text-primary-600'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            )}
        >
            {label}
            {count != null && count > 0 && (
                <span className={cn('rounded-full px-1.5 text-xs font-semibold', badgeTone)}>
                    {count}
                </span>
            )}
        </button>
    );
}

// ── Filter controls ────────────────────────────────────────────────────────

function FilterText({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <div className="flex flex-col gap-1">
            <Label className="text-xs text-neutral-600">{label}</Label>
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="h-9 w-40"
            />
        </div>
    );
}

function FilterSelect({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
}) {
    const { t } = useTranslation('audienceManagerCallLogTab');
    return (
        <div className="flex flex-col gap-1">
            <Label className="text-xs text-neutral-600">{label}</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="h-9 w-40 bg-white">
                    <SelectValue placeholder={t('filters.all')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>{t('filters.all')}</SelectItem>
                    {options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                            {o.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

/**
 * Multi-select sibling of {@link FilterSelect} — same caption-above-control shape,
 * but the control is the shared CRM combobox: type-to-search plus as many outcomes
 * as the user wants in one query. Empty selection = no filter, exactly like `ALL`.
 */
function FilterMultiSelect({
    label,
    selected,
    onChange,
    options,
}: {
    label: string;
    selected: string[];
    onChange: (v: string[]) => void;
    options: Array<{ value: string; label: string }>;
}) {
    const { t } = useTranslation('audienceManagerCallLogTab');
    return (
        <div className="flex flex-col gap-1">
            <Label className="text-xs text-neutral-600">{label}</Label>
            <MultiSelectFilter
                label={t('filters.all')}
                options={options}
                selected={selected}
                onChange={onChange}
                placeholder={t('filters.searchPlaceholder', { label: label.toLowerCase() })}
                // twMerge lets these win over the component's default h-10 / w-44,
                // so the trigger lines up with the FilterSelect boxes beside it.
                widthClass="h-9 w-40"
                showSelectedLabel
            />
        </div>
    );
}

// ── Cell renderers ─────────────────────────────────────────────────────────

function DirectionBadge({ direction }: { direction: string }) {
    const { t } = useTranslation('audienceManagerCallLogTab');
    const inbound = direction === 'INBOUND';
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                inbound ? 'bg-info-50 text-info-700' : 'bg-neutral-100 text-neutral-600'
            )}
        >
            {inbound ? (
                <PhoneIncoming size={12} weight="bold" />
            ) : (
                <PhoneOutgoing size={12} weight="bold" />
            )}
            {inbound ? t('directionBadge.in') : t('directionBadge.out')}
        </span>
    );
}

function TypeBadge({ callType }: { callType: 'AI' | 'HUMAN' }) {
    const { t } = useTranslation('audienceManagerCallLogTab');
    const ai = callType === 'AI';
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                ai ? 'bg-primary-50 text-primary-600' : 'bg-neutral-100 text-neutral-600'
            )}
        >
            {ai ? <Robot size={12} weight="bold" /> : <User size={12} weight="bold" />}
            {ai ? t('typeBadge.ai') : t('typeBadge.human')}
        </span>
    );
}

function CallStatusPill({ status }: { status: string }) {
    return (
        <span
            className={cn(
                'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_TONE[status] ?? 'bg-neutral-100 text-neutral-600'
            )}
        >
            {humanizeCallStatus(status)}
        </span>
    );
}

function humanizeProvider(t: TFunction, p: string | null | undefined): string {
    if (!p) return '—';
    return buildProviderOptions(t).find((o) => o.value === p)?.label ?? p;
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-3 text-xs">
            <span className="shrink-0 text-neutral-500">{label}</span>
            <span className="text-right font-medium text-neutral-700">{value}</span>
        </div>
    );
}

/**
 * Status pill that, for calls that didn't simply complete (FAILED / BUSY /
 * NO_ANSWER / CANCELLED), doubles as a "why" affordance: clicking opens a popover
 * that lazily loads the deep detail (provider hangup/cause/error, price, timing).
 */
function StatusCell({ instituteId, row }: { instituteId: string; row: CallRow }) {
    const { t } = useTranslation('audienceManagerCallLogTab');
    const [open, setOpen] = useState(false);
    const detailable = isDetailable(row);

    const detailQuery = useQuery({
        queryKey: callDetailKey(instituteId, row.id),
        queryFn: () => fetchCallDetail(instituteId, row.id),
        enabled: open && detailable,
        staleTime: 60_000,
        retry: false,
    });

    if (!detailable) return <CallStatusPill status={row.status} />;

    const d = detailQuery.data;
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full hover:opacity-80"
                    title={t('statusDetail.whyEnded')}
                >
                    <CallStatusPill status={row.status} />
                    <Info size={14} className="text-neutral-400" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <CallStatusPill status={row.status} />
                    <span className="text-xs text-neutral-500">
                        {fmtDateTime(row.start_time ?? row.created_at)}
                    </span>
                </div>
                {detailQuery.isLoading ? (
                    <p className="text-xs text-neutral-500">{t('statusDetail.loading')}</p>
                ) : detailQuery.isError ? (
                    <p className="text-xs text-neutral-500">
                        {row.termination_reason
                            ? t('statusDetail.reasonPrefix', { reason: row.termination_reason })
                            : t('statusDetail.noDetail')}
                    </p>
                ) : d ? (
                    <div className="flex flex-col gap-1.5">
                        <DetailRow
                            label={t('statusDetail.reason')}
                            value={d.termination_reason || row.termination_reason || '—'}
                        />
                        <DetailRow
                            label={t('statusDetail.provider')}
                            value={humanizeProvider(t, d.provider_type)}
                        />
                        {d.provider_details.map((kv, i) => (
                            <DetailRow key={i} label={kv.label} value={kv.value} />
                        ))}
                        <DetailRow
                            label={t('statusDetail.attempted')}
                            value={fmtDateTime(d.start_time)}
                        />
                        <DetailRow
                            label={t('statusDetail.answered')}
                            value={d.answer_time ? fmtDateTime(d.answer_time) : '—'}
                        />
                        <DetailRow
                            label={t('statusDetail.duration')}
                            value={fmtDuration(d.duration_seconds)}
                        />
                        {d.price != null && (
                            <DetailRow label={t('statusDetail.cost')} value={String(d.price)} />
                        )}
                        {d.raw_provider_response && (
                            <details className="mt-1">
                                <summary className="cursor-pointer text-xs text-primary-600">
                                    {t('statusDetail.viewRawResponse')}
                                </summary>
                                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-2 text-caption text-neutral-600">
                                    {d.raw_provider_response}
                                </pre>
                            </details>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-neutral-500">{t('statusDetail.noDetail')}</p>
                )}
            </PopoverContent>
        </Popover>
    );
}

function DispositionCell({
    row,
    labels,
    onEdit,
}: {
    row: CallRow;
    /** Normalized outcome key → vocabulary label, so the cell reads like the filter. */
    labels: Map<string, string>;
    onEdit: () => void;
}) {
    const { t } = useTranslation('audienceManagerCallLogTab');
    // Human-set disposition takes precedence; otherwise show the AI disposition (read-only).
    const current = row.disposition_key || row.ai_disposition;
    // Same normalization the filter matches on, so "Not_Interested" and
    // "NOT_INTERESTED" render as the one option the dropdown offers.
    const label = current
        ? labels.get(normalizeDispositionKey(current)) ?? humanizeCallStatus(current)
        : null;
    return (
        <div className="flex items-center gap-2">
            {label ? (
                <span className="inline-flex whitespace-nowrap rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    {label}
                </span>
            ) : (
                <span className="text-xs text-neutral-400">—</span>
            )}
            <MyButton buttonType="text" scale="small" onClick={onEdit}>
                {row.disposition_key ? t('disposition.edit') : t('disposition.set')}
            </MyButton>
        </div>
    );
}

function RecordingCell({ instituteId, row }: { instituteId: string; row: CallRow }) {
    const { t } = useTranslation('audienceManagerCallLogTab');
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    if (!row.has_recording) return <span className="text-xs text-neutral-400">—</span>;
    if (url) return <audio controls src={url} className="h-8 w-44" />;

    const load = async () => {
        setLoading(true);
        setFailed(false);
        try {
            const u = await fetchRecordingUrl(instituteId, row.id);
            if (u) setUrl(u);
            else setFailed(true);
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <MyButton buttonType="secondary" scale="small" onClick={load} disable={loading}>
            <span className="flex items-center gap-1.5">
                <Waveform size={14} weight="fill" />
                {loading ? t('recording.loading') : failed ? t('common.retry') : t('recording.play')}
            </span>
        </MyButton>
    );
}

// ── Export ─────────────────────────────────────────────────────────────────

function ExportButton({
    scope,
    filters,
    disabled,
}: {
    scope: CallLogScope;
    filters: CallLogFilters;
    disabled: boolean;
}) {
    const { t } = useTranslation('audienceManagerCallLogTab');
    const run = async (format: 'csv' | 'xlsx') => {
        try {
            await exportCallLog(scope, filters, format);
            toast.success(t('export.successToast', { format: format.toUpperCase() }));
        } catch {
            toast.error(t('export.errorToast'));
        }
    };
    return (
        <div className="flex items-center gap-2">
            <MyButton
                buttonType="secondary"
                scale="small"
                onAsyncClick={() => run('csv')}
                disable={disabled}
            >
                <span className="flex items-center gap-1.5">
                    <DownloadSimple size={14} />
                    {t('export.csv')}
                </span>
            </MyButton>
            <MyButton
                buttonType="secondary"
                scale="small"
                onAsyncClick={() => run('xlsx')}
                disable={disabled}
            >
                <span className="flex items-center gap-1.5">
                    <DownloadSimple size={14} />
                    {t('export.excel')}
                </span>
            </MyButton>
        </div>
    );
}

// ── Quick-disposition dialog ───────────────────────────────────────────────

function DispositionDialog({
    instituteId,
    call,
    options,
    onClose,
    onApplied,
}: {
    instituteId: string;
    call: CallRow | null;
    options: DispositionOption[];
    onClose: () => void;
    onApplied: () => void;
}) {
    const { t } = useTranslation('audienceManagerCallLogTab');
    const [selected, setSelected] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [callbackAt, setCallbackAt] = useState('');

    useEffect(() => {
        setSelected(call?.disposition_key ?? '');
        setNotes(call?.disposition_notes ?? '');
        setCallbackAt('');
    }, [call]);

    const selectedOption = options.find((o) => o.disposition_key === selected);
    const isCallback = selectedOption?.category === 'CALLBACK';

    const mutation = useMutation({
        mutationFn: () => {
            const ms = isCallback && callbackAt ? new Date(callbackAt).getTime() : null;
            return applyDisposition(instituteId, call!.id, selected, notes, ms);
        },
        onSuccess: (res) => {
            toast.success(
                res.lead_status_synced
                    ? t('dispositionDialog.savedStatusUpdated')
                    : t('dispositionDialog.saved')
            );
            onApplied();
        },
        onError: () => toast.error(t('dispositionDialog.saveError')),
    });

    return (
        <MyDialog
            heading={t('dispositionDialog.heading')}
            open={!!call}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            footer={
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    disable={!selected || mutation.isPending}
                    onAsyncClick={async () => {
                        await mutation.mutateAsync();
                    }}
                >
                    {t('dispositionDialog.save')}
                </MyButton>
            }
        >
            <div className="flex flex-col gap-4">
                {call && (
                    <p className="text-sm text-neutral-600">
                        {call.lead_name || t('common.leadFallback')} ·{' '}
                        {fmtDuration(call.duration_seconds)} · {humanizeCallStatus(call.status)}
                    </p>
                )}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-neutral-600">
                        {t('dispositionDialog.outcome')}
                    </Label>
                    <div className="flex flex-wrap gap-2">
                        {options.map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                onClick={() => setSelected(o.disposition_key)}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                                    selected === o.disposition_key
                                        ? 'border-primary-500 bg-primary-50 text-primary-600'
                                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                                )}
                            >
                                {o.label}
                                {o.maps_to_lead_status && (
                                    <span className="text-xs text-neutral-400">
                                        {t('dispositionDialog.mapsToStatus')}
                                    </span>
                                )}
                            </button>
                        ))}
                        {options.length === 0 && (
                            <span className="text-sm text-neutral-400">
                                {t('dispositionDialog.noOutcomes')}
                            </span>
                        )}
                    </div>
                </div>
                {isCallback && (
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-neutral-600">
                            {t('dispositionDialog.callbackAt')}
                        </Label>
                        <Input
                            type="datetime-local"
                            value={callbackAt}
                            onChange={(e) => setCallbackAt(e.target.value)}
                            className="h-9 w-60"
                        />
                    </div>
                )}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-neutral-600">
                        {t('dispositionDialog.notes')}
                    </Label>
                    <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('dispositionDialog.notesPlaceholder')}
                        className="h-9"
                    />
                </div>
            </div>
        </MyDialog>
    );
}

// ── Transcript + AI intelligence dialog (credits-gated) ─────────────────────

/**
 * Hosts the shared {@link CallIntelligencePanel} in a dialog and gates every
 * analyze/re-analyze behind a credits-cost confirmation. Call Intelligence is
 * billed per analyzed call (re-analyzing the same call is idempotent — never
 * charged twice), so we fetch a live estimate + the institute balance and show
 * {@link ToolCostConfirmDialog} before the pipeline is triggered.
 */
function CallIntelligenceDialog({ call, onClose }: { call: CallRow | null; onClose: () => void }) {
    const { t } = useTranslation('audienceManagerCallLogTab');
    const [confirmData, setConfirmData] = useState<{
        credits: number | null;
        currentBalance: number | null;
        balanceAfter: number | null;
        sufficient: boolean | null;
    } | null>(null);
    const resolverRef = useRef<((v: boolean) => void) | null>(null);

    const settle = (v: boolean) => {
        const resolve = resolverRef.current;
        resolverRef.current = null;
        setConfirmData(null);
        resolve?.(v);
    };

    const confirmBeforeAnalyze = () =>
        new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
            void (async () => {
                try {
                    const est = await fetchCreditEstimate('call_intelligence');
                    setConfirmData({
                        credits: est.estimated_cost ?? null,
                        currentBalance: est.current_balance ?? null,
                        balanceAfter: est.balance_after ?? null,
                        sufficient: est.has_sufficient_credits ?? null,
                    });
                } catch {
                    // Estimate endpoint unavailable — still ask for explicit confirmation,
                    // just without the exact number.
                    setConfirmData({
                        credits: null,
                        currentBalance: null,
                        balanceAfter: null,
                        sufficient: null,
                    });
                }
            })();
        });

    return (
        <>
            <MyDialog
                heading={t('intelligenceDialog.heading')}
                open={!!call}
                onOpenChange={(o) => {
                    if (!o) onClose();
                }}
                dialogWidth="max-w-lg"
            >
                {call && (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-neutral-600">
                            {call.lead_name || t('common.leadFallback')} ·{' '}
                            {fmtDuration(call.duration_seconds)} ·{' '}
                            {humanizeCallStatus(call.status)}
                        </p>
                        <CallIntelligencePanel
                            callLogId={call.id}
                            defaultExpanded
                            confirmBeforeAnalyze={confirmBeforeAnalyze}
                        />
                    </div>
                )}
            </MyDialog>

            <ToolCostConfirmDialog
                open={!!confirmData}
                onOpenChange={(o) => {
                    if (!o) settle(false);
                }}
                credits={confirmData?.credits ?? null}
                currentBalance={confirmData?.currentBalance ?? null}
                balanceAfter={confirmData?.balanceAfter ?? null}
                sufficient={confirmData?.sufficient ?? null}
                onConfirm={() => settle(true)}
                heading={t('intelligenceDialog.analyzeHeading')}
                confirmLabel={t('intelligenceDialog.analyzeConfirm')}
            />
        </>
    );
}

// ── Shared states / KPI ────────────────────────────────────────────────────

interface KpiStatProps {
    label: string;
    value: string;
    sub?: string;
    tone: 'primary' | 'success' | 'info' | 'warning' | 'default';
    loading?: boolean;
}
function KpiStat({ label, value, sub, tone, loading }: KpiStatProps) {
    const toneClass: Record<KpiStatProps['tone'], string> = {
        primary: 'text-primary-600',
        success: 'text-success-700',
        info: 'text-info-700',
        warning: 'text-warning-700',
        default: 'text-neutral-900',
    };
    return (
        <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {label}
            </span>
            {loading ? (
                <span className="h-7 w-20 animate-pulse rounded bg-neutral-100" />
            ) : (
                <span className={cn('text-2xl font-bold tracking-tight', toneClass[tone])}>
                    {value}
                </span>
            )}
            {sub && <span className="text-xs text-neutral-500">{sub}</span>}
        </div>
    );
}

function DeployPendingNotice() {
    const { t } = useTranslation('audienceManagerCallLogTab');
    return (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
            <WarningCircle size={28} className="text-neutral-400" />
            <p className="text-sm font-medium text-neutral-700">{t('deployPending.title')}</p>
            <p className="max-w-md text-xs text-neutral-500">{t('deployPending.description')}</p>
        </div>
    );
}

function ErrorNotice({ onRetry }: { onRetry: () => void }) {
    const { t } = useTranslation('audienceManagerCallLogTab');
    return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
            <WarningCircle size={24} className="text-danger-500" />
            <p className="text-sm text-neutral-600">{t('error.loadFailed')}</p>
            <MyButton buttonType="secondary" scale="small" onClick={onRetry}>
                <span className="flex items-center gap-2">
                    <ArrowsClockwise size={14} />
                    {t('common.retry')}
                </span>
            </MyButton>
        </div>
    );
}

function LoadingBlock() {
    return <div className="h-64 animate-pulse rounded-lg bg-neutral-100" />;
}

function EmptyBlock({ message }: { message: string }) {
    return (
        <div className="flex h-32 items-center justify-center text-sm text-neutral-400">
            {message}
        </div>
    );
}
