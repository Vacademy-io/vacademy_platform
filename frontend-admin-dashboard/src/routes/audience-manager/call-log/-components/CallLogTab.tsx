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
 *      playback, and a per-row quick-disposition that syncs lead status.
 *   4. Export — CSV / XLSX of the current filtered view (server-rendered).
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowsClockwise,
    DownloadSimple,
    PhoneIncoming,
    PhoneOutgoing,
    Robot,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { TELEPHONY_CALL_STATUSES, humanizeCallStatus } from '@/hooks/use-lead-report-settings';
import {
    applyDisposition,
    callLogMetricsKey,
    callLogSearchKey,
    dispositionCatalogKey,
    exportCallLog,
    fetchCallLog,
    fetchCallMetrics,
    fetchDispositionCatalog,
    fetchRecordingUrl,
    isCallLogEndpointMissing,
    toMillis,
    type CallLogFilters,
    type CallLogScope,
    type CallRow,
    type DispositionOption,
} from '../-services/call-log-service';

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

const PROVIDER_OPTIONS = [
    { value: 'EXOTEL', label: 'Exotel' },
    { value: 'AAVTAAR', label: 'AI (Aavtaar)' },
    { value: 'AIRTEL', label: 'Airtel' },
] as const;

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

// ── Main component (contract-fixed export + props) ─────────────────────────

export default function CallLogTab({
    instituteId,
    fromDate,
    toDate,
    teamId,
    counsellorUserId,
}: CallLogTabProps) {
    const queryClient = useQueryClient();
    const scope: CallLogScope = { instituteId, fromDate, toDate, teamId, counsellorUserId };

    // Tab-local filters.
    const [direction, setDirection] = useState<string>(ALL);
    const [callType, setCallType] = useState<string>(ALL);
    const [providerType, setProviderType] = useState<string>(ALL);
    const [status, setStatus] = useState<string>(ALL);
    const [dispositionKey, setDispositionKey] = useState<string>(ALL);
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
            dispositionKeys: dispositionKey === ALL ? undefined : [dispositionKey],
            leadName: leadName.trim() || undefined,
            toNumber: toNumber.trim() || undefined,
            missedInbound: chip === 'MISSED' || undefined,
            callbacksDue: chip === 'CALLBACKS' || undefined,
            sortBy: 'TIME',
            sortDirection: 'DESC',
        }),
        [direction, callType, providerType, status, dispositionKey, leadName, toNumber, chip]
    );

    // Any filter / scope change resets to the first page.
    const filterSig = JSON.stringify([scope, filters]);
    useEffect(() => setPage(0), [filterSig]);

    const retryUnlessMissing = (failureCount: number, error: unknown) =>
        !isCallLogEndpointMissing(error) && failureCount < 2;

    const catalogQuery = useQuery({
        queryKey: dispositionCatalogKey(instituteId),
        queryFn: () => fetchDispositionCatalog(instituteId),
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
        return <EmptyBlock message="Pick an institute to view the call log." />;
    }
    if (searchQuery.isError && isCallLogEndpointMissing(searchQuery.error)) {
        return <DeployPendingNotice />;
    }

    const metrics = metricsQuery.data;
    const dispositions = catalogQuery.data ?? [];
    const data = searchQuery.data;
    const rows = data?.content ?? [];

    return (
        <div className="flex flex-col gap-6">
            {/* 1 — KPI strip */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <KpiStat label="Total calls" value={fmtNumber(metrics?.total_calls)} tone="primary" loading={metricsQuery.isLoading} />
                <KpiStat label="Connected" value={fmtNumber(metrics?.connected_calls)} sub={fmtPct(metrics?.connect_rate)} tone="success" loading={metricsQuery.isLoading} />
                <KpiStat label="Talk time" value={fmtTalkHm(metrics?.total_talk_seconds)} sub="h : mm" tone="warning" loading={metricsQuery.isLoading} />
                <KpiStat label="Unique leads" value={fmtNumber(metrics?.unique_leads)} tone="info" loading={metricsQuery.isLoading} />
                <KpiStat
                    label="AI vs human"
                    value={`${fmtNumber(metrics?.ai_calls)} / ${fmtNumber(metrics?.human_calls)}`}
                    sub="AI / human"
                    tone="default"
                    loading={metricsQuery.isLoading}
                />
            </div>

            {/* 2 — Worklist chips + filter bar */}
            <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <ChipToggle active={chip === 'NONE'} onClick={() => setChip('NONE')} label="All calls" />
                    <ChipToggle
                        active={chip === 'MISSED'}
                        onClick={() => setChip(chip === 'MISSED' ? 'NONE' : 'MISSED')}
                        label="Missed inbound"
                        count={metrics?.missed_inbound_due}
                        tone="danger"
                    />
                    <ChipToggle
                        active={chip === 'CALLBACKS'}
                        onClick={() => setChip(chip === 'CALLBACKS' ? 'NONE' : 'CALLBACKS')}
                        label="Callbacks due"
                        count={metrics?.callbacks_due}
                        tone="warning"
                    />
                    <div className="ml-auto flex items-center gap-2">
                        <ExportButton scope={scope} filters={filters} disabled={rows.length === 0} />
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                    <FilterText label="Lead name" value={leadName} onChange={setLeadName} placeholder="Search name" />
                    <FilterText label="Number" value={toNumber} onChange={setToNumber} placeholder="Phone digits" />
                    <FilterSelect label="Direction" value={direction} onChange={setDirection} options={[
                        { value: 'OUTBOUND', label: 'Outbound' },
                        { value: 'INBOUND', label: 'Inbound' },
                    ]} />
                    <FilterSelect label="Type" value={callType} onChange={setCallType} options={[
                        { value: 'HUMAN', label: 'Human' },
                        { value: 'AI', label: 'AI' },
                    ]} />
                    <FilterSelect label="Provider" value={providerType} onChange={setProviderType} options={PROVIDER_OPTIONS.map((p) => ({ value: p.value, label: p.label }))} />
                    <FilterSelect label="Status" value={status} onChange={setStatus} options={TELEPHONY_CALL_STATUSES.map((s) => ({ value: s, label: humanizeCallStatus(s) }))} />
                    <FilterSelect
                        label="Disposition"
                        value={dispositionKey}
                        onChange={setDispositionKey}
                        options={dispositions.map((d) => ({ value: d.disposition_key, label: d.label }))}
                    />
                </div>
            </section>

            {/* 3 — Call table */}
            <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-neutral-900">
                        Calls
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
                    <EmptyBlock message="No calls match these filters." />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                                        <th className="py-2 pr-3">Time</th>
                                        <th className="py-2 pr-3">Lead</th>
                                        <th className="py-2 pr-3">Dir</th>
                                        <th className="py-2 pr-3">Type</th>
                                        <th className="py-2 pr-3">Status</th>
                                        <th className="py-2 pr-3 text-right">Duration</th>
                                        <th className="py-2 pr-3">Counsellor</th>
                                        <th className="py-2 pr-3">Disposition</th>
                                        <th className="py-2 pr-3">Recording</th>
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
                                                    <span className="font-medium text-neutral-900">
                                                        {r.lead_name || '—'}
                                                    </span>
                                                    <span className="text-xs text-neutral-500">
                                                        {r.lead_number || '—'}
                                                    </span>
                                                    {r.ivr_selection && (
                                                        <span
                                                            className="mt-1 inline-flex w-fit items-center rounded-sm bg-primary-50 px-2 py-0.5 text-caption font-medium text-primary-700"
                                                            title="IVR option chosen"
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
                                                <CallStatusPill status={r.status} />
                                            </td>
                                            <td className="py-2.5 pr-3 text-right text-neutral-700">
                                                {fmtDuration(r.duration_seconds)}
                                            </td>
                                            <td className="py-2.5 pr-3 text-neutral-700">
                                                {r.counsellor_name || '—'}
                                            </td>
                                            <td className="py-2.5 pr-3">
                                                <DispositionCell row={r} onEdit={() => setDispositionTarget(r)} />
                                            </td>
                                            <td className="py-2.5 pr-3">
                                                <RecordingCell instituteId={instituteId} row={r} />
                                            </td>
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
        </div>
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
    return (
        <div className="flex flex-col gap-1">
            <Label className="text-xs text-neutral-600">{label}</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="h-9 w-40 bg-white">
                    <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>All</SelectItem>
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

// ── Cell renderers ─────────────────────────────────────────────────────────

function DirectionBadge({ direction }: { direction: string }) {
    const inbound = direction === 'INBOUND';
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                inbound ? 'bg-info-50 text-info-700' : 'bg-neutral-100 text-neutral-600'
            )}
        >
            {inbound ? <PhoneIncoming size={12} weight="bold" /> : <PhoneOutgoing size={12} weight="bold" />}
            {inbound ? 'In' : 'Out'}
        </span>
    );
}

function TypeBadge({ callType }: { callType: 'AI' | 'HUMAN' }) {
    const ai = callType === 'AI';
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                ai ? 'bg-primary-50 text-primary-600' : 'bg-neutral-100 text-neutral-600'
            )}
        >
            {ai ? <Robot size={12} weight="bold" /> : <User size={12} weight="bold" />}
            {ai ? 'AI' : 'Human'}
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

function DispositionCell({ row, onEdit }: { row: CallRow; onEdit: () => void }) {
    // Human-set disposition takes precedence; otherwise show the AI disposition (read-only).
    const current = row.disposition_key || row.ai_disposition;
    return (
        <div className="flex items-center gap-2">
            {current ? (
                <span className="inline-flex whitespace-nowrap rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    {humanizeCallStatus(current)}
                </span>
            ) : (
                <span className="text-xs text-neutral-400">—</span>
            )}
            <MyButton buttonType="text" scale="small" onClick={onEdit}>
                {row.disposition_key ? 'Edit' : 'Set'}
            </MyButton>
        </div>
    );
}

function RecordingCell({ instituteId, row }: { instituteId: string; row: CallRow }) {
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
                {loading ? 'Loading…' : failed ? 'Retry' : 'Play'}
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
    const run = async (format: 'csv' | 'xlsx') => {
        try {
            await exportCallLog(scope, filters, format);
            toast.success(`Exported ${format.toUpperCase()}`);
        } catch {
            toast.error('Export failed. Please try again.');
        }
    };
    return (
        <div className="flex items-center gap-2">
            <MyButton buttonType="secondary" scale="small" onAsyncClick={() => run('csv')} disable={disabled}>
                <span className="flex items-center gap-1.5">
                    <DownloadSimple size={14} />
                    CSV
                </span>
            </MyButton>
            <MyButton buttonType="secondary" scale="small" onAsyncClick={() => run('xlsx')} disable={disabled}>
                <span className="flex items-center gap-1.5">
                    <DownloadSimple size={14} />
                    Excel
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
                    ? `Saved — lead status updated`
                    : 'Disposition saved'
            );
            onApplied();
        },
        onError: () => toast.error('Could not save the disposition.'),
    });

    return (
        <MyDialog
            heading="Set call disposition"
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
                    Save
                </MyButton>
            }
        >
            <div className="flex flex-col gap-4">
                {call && (
                    <p className="text-sm text-neutral-600">
                        {call.lead_name || 'Lead'} · {fmtDuration(call.duration_seconds)} ·{' '}
                        {humanizeCallStatus(call.status)}
                    </p>
                )}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-neutral-600">Outcome</Label>
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
                                    <span className="text-xs text-neutral-400">→ status</span>
                                )}
                            </button>
                        ))}
                        {options.length === 0 && (
                            <span className="text-sm text-neutral-400">No outcomes configured.</span>
                        )}
                    </div>
                </div>
                {isCallback && (
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-neutral-600">Call back at</Label>
                        <Input
                            type="datetime-local"
                            value={callbackAt}
                            onChange={(e) => setCallbackAt(e.target.value)}
                            className="h-9 w-60"
                        />
                    </div>
                )}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-neutral-600">Notes (optional)</Label>
                    <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add a note"
                        className="h-9"
                    />
                </div>
            </div>
        </MyDialog>
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
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
            {loading ? (
                <span className="h-7 w-20 animate-pulse rounded bg-neutral-100" />
            ) : (
                <span className={cn('text-2xl font-bold tracking-tight', toneClass[tone])}>{value}</span>
            )}
            {sub && <span className="text-xs text-neutral-500">{sub}</span>}
        </div>
    );
}

function DeployPendingNotice() {
    return (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
            <WarningCircle size={28} className="text-neutral-400" />
            <p className="text-sm font-medium text-neutral-700">
                The call dashboard isn&apos;t available on this server yet
            </p>
            <p className="max-w-md text-xs text-neutral-500">
                The telephony dashboard endpoints haven&apos;t been deployed to this environment. Check
                back after the next backend release.
            </p>
        </div>
    );
}

function ErrorNotice({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
            <WarningCircle size={24} className="text-danger-500" />
            <p className="text-sm text-neutral-600">Couldn&apos;t load the call log.</p>
            <MyButton buttonType="secondary" scale="small" onClick={onRetry}>
                <span className="flex items-center gap-2">
                    <ArrowsClockwise size={14} />
                    Retry
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
        <div className="flex h-32 items-center justify-center text-sm text-neutral-400">{message}</div>
    );
}
