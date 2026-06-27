/**
 * Call Log — a standalone CRM page (sidebar: Leads → Call Log), NOT a Reports
 * tab. The operational, row-level call list across AI + human, inbound +
 * outbound, every provider.
 *
 * Owns its own chrome + filter bar (date range / team / counsellor) — the same
 * shared-filter idiom as the Reports Center shell — and feeds the applied window
 * to {@link CallLogTab}, which renders the KPIs, worklist chips, table and
 * disposition flow.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowsClockwise, User } from '@phosphor-icons/react';
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
import { cn } from '@/lib/utils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { TeamPicker } from '@/components/shared/crm/TeamPicker';
import {
    fetchMyTeam,
    fetchTeamCounsellors,
} from '@/routes/counsellors/-services/counsellor-workbench-services';
import CallLogTab from './CallLogTab';

// ── Date helpers (mirror the Reports shell) ────────────────────────────────

const DEFAULT_DAYS = 30;
const toDateInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
const computeRange = (days: number) => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    return { from: toDateInput(start), to: toDateInput(now) };
};

const PRESETS = [
    { key: '7', label: '7d', days: 7 },
    { key: '30', label: '30d', days: 30 },
    { key: '90', label: '90d', days: 90 },
] as const;

const ALL_COUNSELLORS_VALUE = '__ALL_COUNSELLORS__';

// ── Page ───────────────────────────────────────────────────────────────────

export function CallLogPage() {
    const setNavHeading = useNavHeadingStore((s) => s.setNavHeading);
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Call Log</h1>);
    }, [setNavHeading]);

    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id ?? '';
    const queryClient = useQueryClient();

    const defaults = useMemo(() => computeRange(DEFAULT_DAYS), []);
    const [fromDate, setFromDate] = useState(defaults.from);
    const [toDate, setToDate] = useState(defaults.to);
    const [applied, setApplied] = useState(defaults);
    const [teamId, setTeamId] = useState<string | undefined>(undefined);
    const [counsellorUserId, setCounsellorUserId] = useState<string | undefined>(undefined);

    const activePreset = PRESETS.find((p) => {
        const r = computeRange(p.days);
        return applied.from === r.from && applied.to === r.to;
    })?.key;

    const applyPreset = (days: number) => {
        const r = computeRange(days);
        setFromDate(r.from);
        setToDate(r.to);
        setApplied(r);
    };
    const apply = () => setApplied({ from: fromDate, to: toDate });
    const reset = () => {
        setFromDate(defaults.from);
        setToDate(defaults.to);
        setApplied(defaults);
        setTeamId(undefined);
        setCounsellorUserId(undefined);
    };
    const handleTeamChange = (next: string | undefined) => {
        setTeamId(next);
        setCounsellorUserId(undefined);
    };

    const [isRefreshing, setIsRefreshing] = useState(false);
    const refresh = async () => {
        setIsRefreshing(true);
        try {
            await queryClient.invalidateQueries({
                predicate: (q) =>
                    typeof q.queryKey[0] === 'string' &&
                    (q.queryKey[0] as string).startsWith('crm-call-log'),
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="flex min-h-full flex-col gap-6 bg-neutral-50 p-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Call Log</h1>
                    <p className="text-sm text-neutral-600">
                        Every call across your team — AI &amp; human, inbound &amp; outbound, all
                        providers. Filter, disposition and export.
                    </p>
                </div>
                <Button
                    onClick={refresh}
                    size="sm"
                    variant="outline"
                    disabled={!instituteId || isRefreshing}
                    className="gap-2"
                >
                    <ArrowsClockwise size={14} className={cn(isRefreshing && 'animate-spin')} />
                    Refresh
                </Button>
            </header>

            {/* Shared filter bar */}
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-1 self-end rounded-md border border-neutral-200 bg-white p-1">
                    {PRESETS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => applyPreset(p.days)}
                            className={cn(
                                'rounded px-2.5 py-1 text-xs',
                                activePreset === p.key
                                    ? 'bg-primary-500 text-white'
                                    : 'text-neutral-600 hover:bg-neutral-50'
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor="cl-from" className="text-xs text-neutral-600">
                        From
                    </Label>
                    <Input
                        id="cl-from"
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-40"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor="cl-to" className="text-xs text-neutral-600">
                        To
                    </Label>
                    <Input
                        id="cl-to"
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-40"
                    />
                </div>
                <Button onClick={apply} size="sm" disabled={!instituteId}>
                    Apply
                </Button>
                <Button onClick={reset} size="sm" variant="ghost">
                    Reset
                </Button>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <TeamPicker instituteId={instituteId} value={teamId} onChange={handleTeamChange} />
                    <CounsellorScopePicker
                        instituteId={instituteId}
                        teamId={teamId}
                        value={counsellorUserId}
                        onChange={setCounsellorUserId}
                    />
                </div>
            </div>

            {!instituteId ? (
                <div className="rounded-xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-700">
                    Pick an institute to view the call log.
                </div>
            ) : (
                <CallLogTab
                    instituteId={instituteId}
                    fromDate={applied.from}
                    toDate={applied.to}
                    teamId={teamId}
                    counsellorUserId={counsellorUserId}
                />
            )}
        </div>
    );
}

// ── Counsellor scope picker (same contract as the Reports shell) ────────────

function CounsellorScopePicker({
    instituteId,
    teamId,
    value,
    onChange,
}: {
    instituteId: string;
    teamId: string | undefined;
    value: string | undefined;
    onChange: (userId: string | undefined) => void;
}) {
    const myTeamQuery = useQuery({
        queryKey: ['workbench-my-team', instituteId],
        enabled: !!instituteId,
        retry: false,
        staleTime: 5 * 60 * 1000,
        queryFn: () => fetchMyTeam(instituteId),
    });
    const rosterTeamId = teamId ?? myTeamQuery.data?.team_id;

    const rosterQuery = useQuery({
        queryKey: ['report-counsellor-roster', instituteId, rosterTeamId],
        enabled: !!instituteId && !!rosterTeamId,
        retry: false,
        staleTime: 5 * 60 * 1000,
        queryFn: () => fetchTeamCounsellors(instituteId, rosterTeamId!, { size: 500 }),
    });

    const options = useMemo(
        () =>
            (rosterQuery.data?.content ?? [])
                .map((c) => ({ id: c.user_id, name: c.full_name ?? c.email ?? c.user_id }))
                .sort((a, b) => a.name.localeCompare(b.name)),
        [rosterQuery.data]
    );

    if (!myTeamQuery.data || rosterQuery.isError || options.length === 0) return null;

    return (
        <Select
            value={value ?? ALL_COUNSELLORS_VALUE}
            onValueChange={(v) => onChange(v === ALL_COUNSELLORS_VALUE ? undefined : v)}
        >
            <SelectTrigger className="h-9 w-52 bg-white" aria-label="Filter by counsellor">
                <User className="mr-1.5 size-4 shrink-0 text-neutral-400" />
                <SelectValue placeholder="All counsellors" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={ALL_COUNSELLORS_VALUE}>All counsellors</SelectItem>
                {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                        {o.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
