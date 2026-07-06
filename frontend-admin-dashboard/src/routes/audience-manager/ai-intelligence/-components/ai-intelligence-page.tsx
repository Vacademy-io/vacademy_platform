/**
 * AI Intelligence (Leads → AI Intelligence) — a date-wise, comparison-first view
 * of call-quality intelligence, built to *show progress over time*:
 *
 *   1. TEAM INSIGHTS (first block): whole-team KPIs (analyzed calls, avg caller
 *      self-goal rating, avg call-output rating, positive sentiment) — each with
 *      the delta vs the immediately-preceding equal-length window ("+0.6 vs prev")
 *      so a manager can see "this improved". Followed by whole-team coaching.
 *   2. COUNSELLOR BREAKDOWN: one row per rep — analyzed calls, both ratings,
 *      leads dispositioned and calling reach, each with its own vs-previous delta,
 *      expandable to "what they can improve" (their coaching from transcripts).
 *
 * RBAC: every source here is server-scoped to the caller's descendants — the team
 * analytics/coaching endpoints resolve `descendantUserIdsForCaller`, and the
 * dispositions report is scoped by the caller too. A manager sees only their
 * own reports; the per-counsellor set shown is exactly that scoped roster.
 *
 * Read-only. No new endpoints: current + previous windows are two calls each and
 * the deltas are computed here.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Sparkle,
    UsersThree,
    TrendUp,
    TrendDown,
    Minus,
    CaretDown,
    CaretRight,
    Target,
    Lightbulb,
    ChartLineUp,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    TeamCoachingSection,
    useCallIntelligenceEnabled,
    useHasCallIntelligenceData,
    fetchTeamCallIntelligence,
    type CallIntelligenceAnalyticsDto,
} from '@/components/shared/leads';
import {
    fetchCounsellorCoaching,
    fetchTeamCoaching,
    type CallIntelligenceCoachingDto,
} from '@/components/shared/leads/services/call-intelligence';
import { fetchDispositions, type DispositionReport } from '../../reports/-services/get-crm-reports';

// ── Time windows ────────────────────────────────────────────────────────────
interface Win {
    from: number;
    to: number;
    fromDate: string;
    toDate: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESETS = [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
] as const;

/** The selected period — a rolling preset, or an explicit custom range. */
type Period = { kind: 'preset'; days: number } | { kind: 'custom'; fromMs: number; toMs: number };

const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const mkWin = (from: number, to: number): Win => ({
    from,
    to,
    fromDate: toDateStr(from),
    toDate: toDateStr(to),
});

/**
 * The current window plus the immediately-preceding equal-length window we
 * compare it against — this is what makes "improved vs previous" meaningful.
 */
function windowsFor(period: Period): { current: Win; previous: Win } {
    if (period.kind === 'preset') {
        const now = Date.now();
        const curFrom = now - period.days * DAY_MS;
        return {
            current: mkWin(curFrom, now),
            previous: mkWin(curFrom - period.days * DAY_MS, curFrom),
        };
    }
    const len = Math.max(DAY_MS, period.toMs - period.fromMs);
    return {
        current: mkWin(period.fromMs, period.toMs),
        previous: mkWin(period.fromMs - len, period.fromMs),
    };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDay = (ms: number) => {
    const d = new Date(ms);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
const fmtRange = (w: Win) => `${fmtDay(w.from)} – ${fmtDay(w.to)}`;

// ── Delta helpers (all metrics here are "higher is better") ─────────────────
function Delta({
    current,
    previous,
    digits = 1,
    suffix = '',
}: {
    current: number | null | undefined;
    previous: number | null | undefined;
    digits?: number;
    suffix?: string;
}) {
    if (current == null || previous == null) return null;
    const diff = current - previous;
    const eps = digits > 0 ? 0.05 : 0.5;
    if (Math.abs(diff) < eps) {
        return (
            <span className="inline-flex items-center gap-0.5 text-caption text-neutral-400">
                <Minus size={12} /> no change
            </span>
        );
    }
    const up = diff > 0;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 text-caption font-medium',
                up ? 'text-green-700' : 'text-red-600'
            )}
        >
            {up ? <TrendUp size={12} /> : <TrendDown size={12} />}
            {up ? '+' : ''}
            {diff.toFixed(digits)}
            {suffix}
        </span>
    );
}

function KpiDeltaCard({
    label,
    value,
    previous,
    digits = 1,
    suffix = '',
}: {
    label: string;
    value: number | null | undefined;
    previous: number | null | undefined;
    digits?: number;
    suffix?: string;
}) {
    return (
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-4">
            <span className="text-caption uppercase tracking-wide text-neutral-500">{label}</span>
            <span className="text-h3 font-semibold text-neutral-900">
                {value == null ? '—' : `${value.toFixed(digits)}${suffix}`}
            </span>
            <Delta current={value} previous={previous} digits={digits} suffix={suffix} />
        </div>
    );
}

// ── Sentiment helper ─────────────────────────────────────────────────────────
function positivePct(dist: Record<string, number> | undefined): number | null {
    if (!dist) return null;
    const total = Object.values(dist).reduce((s, n) => s + n, 0);
    if (total === 0) return null;
    const pos = Object.entries(dist)
        .filter(([k]) => /pos/i.test(k))
        .reduce((s, [, n]) => s + n, 0);
    return Math.round((pos / total) * 100);
}

// ── Day-to-day activity aggregation (from the dispositions report) ──────────
interface TeamActivity {
    dispositioned: number; // total lead status changes
    calls: number; // total dials
    reach: number | null; // connected / dials %
}
function aggregateActivity(disp: DispositionReport | undefined): TeamActivity {
    if (!disp) return { dispositioned: 0, calls: 0, reach: null };
    const dispositioned = (disp.rows ?? [])
        .filter((r) => r.user_id !== 'SYSTEM')
        .reduce((s, r) => s + r.total_changes, 0);
    let calls = 0;
    let connected = 0;
    for (const c of disp.call_outcomes ?? []) {
        if (c.user_id === 'SYSTEM') continue;
        for (const [k, n] of Object.entries(c.outcomes)) {
            calls += n;
            if (k === 'COMPLETED') connected += n;
        }
    }
    return {
        dispositioned,
        calls,
        reach: calls > 0 ? Math.round((connected / calls) * 100) : null,
    };
}

// ── "What improved" summary (top movers between the two windows) ────────────
interface Mover {
    label: string;
    cur: number | null;
    prev: number | null;
    digits: number;
    suffix: string;
}
function significantMovers(movers: Mover[]): { improved: Mover[]; declined: Mover[] } {
    const improved: Mover[] = [];
    const declined: Mover[] = [];
    for (const m of movers) {
        if (m.cur == null || m.prev == null) continue;
        const diff = m.cur - m.prev;
        const eps = m.digits > 0 ? 0.05 : 0.5;
        if (Math.abs(diff) < eps) continue;
        (diff > 0 ? improved : declined).push(m);
    }
    const mag = (m: Mover) => Math.abs((m.cur ?? 0) - (m.prev ?? 0));
    improved.sort((a, b) => mag(b) - mag(a));
    declined.sort((a, b) => mag(b) - mag(a));
    return { improved: improved.slice(0, 4), declined: declined.slice(0, 4) };
}

/**
 * A natural-language read of the period, grounded in the AI-generated coaching
 * output (top coaching theme / most-hit objection) plus the quantitative movers.
 * Returns null when there's no analyzed-call data to summarize — the caller then
 * falls back to the plain mover chips.
 */
function buildAiSummary(
    movers: Mover[],
    coaching: CallIntelligenceCoachingDto | undefined
): string | null {
    if (!coaching || coaching.totalAnalyzed === 0) return null;
    const phrase = (m: Mover) => {
        const diff = (m.cur ?? 0) - (m.prev ?? 0);
        return `${m.label.toLowerCase()} ${diff > 0 ? '+' : ''}${diff.toFixed(m.digits)}${m.suffix}`;
    };
    const { improved, declined } = significantMovers(movers);
    const parts: string[] = [];
    if (improved.length > 0) {
        parts.push(`Improved: ${improved.slice(0, 3).map(phrase).join(', ')}.`);
    }
    if (declined.length > 0) {
        parts.push(`Watch: ${declined.slice(0, 2).map(phrase).join(', ')}.`);
    }
    const topTip = coaching.topCoachingTips?.[0]?.text;
    const topObj = coaching.topObjections?.[0]?.objection;
    if (topTip) {
        parts.push(`AI coaching focus: ${topTip}`);
    } else if (topObj) {
        parts.push(`Most-hit objection: ${topObj}.`);
    }
    return parts.length > 0 ? parts.join(' ') : null;
}

function MoverChip({ m, up }: { m: Mover; up: boolean }) {
    const diff = (m.cur ?? 0) - (m.prev ?? 0);
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-medium',
                up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            )}
        >
            {up ? <TrendUp size={13} /> : <TrendDown size={13} />}
            {m.label}
            <span className="tabular-nums">
                {up ? '+' : ''}
                {diff.toFixed(m.digits)}
                {m.suffix}
            </span>
        </span>
    );
}

function ImprovementSummary({ movers, aiSummary }: { movers: Mover[]; aiSummary?: string | null }) {
    const { improved, declined } = significantMovers(movers);
    if (improved.length === 0 && declined.length === 0 && !aiSummary) {
        return (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-caption text-neutral-500">
                No meaningful change vs the previous period yet.
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            {aiSummary && (
                <div className="flex items-start gap-1.5">
                    <Sparkle size={14} weight="fill" className="mt-0.5 shrink-0 text-primary-500" />
                    <p className="text-caption text-neutral-700">
                        <span className="font-semibold text-primary-700">AI summary — </span>
                        {aiSummary}
                    </p>
                </div>
            )}
            {improved.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-caption font-semibold text-neutral-600">
                        What improved
                    </span>
                    {improved.map((m) => (
                        <MoverChip key={m.label} m={m} up />
                    ))}
                </div>
            )}
            {declined.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-caption font-semibold text-neutral-600">
                        Needs attention
                    </span>
                    {declined.map((m) => (
                        <MoverChip key={m.label} m={m} up={false} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Team insights block ───────────────────────────────────────────────────────
function TeamInsights({
    instituteId,
    current,
    previous,
}: {
    instituteId: string;
    current: Win;
    previous: Win;
}) {
    const cur = useQuery({
        queryKey: ['ai-intel-team', instituteId, current.from, current.to],
        queryFn: () => fetchTeamCallIntelligence(instituteId, current.from, current.to),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });
    const prev = useQuery({
        queryKey: ['ai-intel-team', instituteId, previous.from, previous.to],
        queryFn: () => fetchTeamCallIntelligence(instituteId, previous.from, previous.to),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });
    // AI coaching for the current window — shares TeamCoachingSection's query key,
    // so the coaching card below and this AI summary come from one fetch.
    const coaching = useQuery({
        queryKey: ['team-coaching', instituteId, current.from, current.to],
        queryFn: () => fetchTeamCoaching(instituteId, current.from, current.to),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });
    // Day-to-day activity — same query keys as the breakdown below, so React Query
    // serves both from one fetch per window (no duplicate network calls).
    const curDisp = useQuery({
        queryKey: ['ai-intel-disp', instituteId, current.fromDate, current.toDate],
        queryFn: () =>
            fetchDispositions({ instituteId, fromDate: current.fromDate, toDate: current.toDate }),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });
    const prevDisp = useQuery({
        queryKey: ['ai-intel-disp', instituteId, previous.fromDate, previous.toDate],
        queryFn: () =>
            fetchDispositions({
                instituteId,
                fromDate: previous.fromDate,
                toDate: previous.toDate,
            }),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });

    const c: CallIntelligenceAnalyticsDto | undefined = cur.data;
    const p: CallIntelligenceAnalyticsDto | undefined = prev.data;
    const actC = aggregateActivity(curDisp.data);
    const actP = aggregateActivity(prevDisp.data);

    const summaryReady = !cur.isLoading && !prev.isLoading && !curDisp.isLoading;
    const movers: Mover[] = [
        {
            label: 'Calls analyzed',
            cur: c?.totalAnalyzed ?? 0,
            prev: p?.totalAnalyzed ?? 0,
            digits: 0,
            suffix: '',
        },
        {
            label: 'Avg caller rating',
            cur: c?.avgCallerSelfGoalRating ?? null,
            prev: p?.avgCallerSelfGoalRating ?? null,
            digits: 1,
            suffix: '',
        },
        {
            label: 'Avg call output',
            cur: c?.avgCallOutputRating ?? null,
            prev: p?.avgCallOutputRating ?? null,
            digits: 1,
            suffix: '',
        },
        {
            label: 'Positive sentiment',
            cur: positivePct(c?.sentimentDistribution),
            prev: positivePct(p?.sentimentDistribution),
            digits: 0,
            suffix: '%',
        },
        {
            label: 'Leads dispositioned',
            cur: actC.dispositioned,
            prev: actP.dispositioned,
            digits: 0,
            suffix: '',
        },
        { label: 'Calls made', cur: actC.calls, prev: actP.calls, digits: 0, suffix: '' },
        { label: 'Team reach', cur: actC.reach, prev: actP.reach, digits: 0, suffix: '%' },
    ];
    const aiSummary = buildAiSummary(movers, coaching.data);

    return (
        <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <UsersThree size={18} className="text-primary-500" />
                <h2 className="text-h3 font-semibold text-neutral-800">Team insights</h2>
            </div>

            {/* Headline — what improved / needs attention vs the previous period,
                with an AI summary grounded in coaching output when available */}
            {summaryReady && <ImprovementSummary movers={movers} aiSummary={aiSummary} />}

            {/* Group 1 — calling & call quality */}
            <div className="flex flex-col gap-2">
                <span className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
                    Calling &amp; call quality
                </span>
                {cur.isLoading ? (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-24 animate-pulse rounded-lg bg-neutral-100" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <KpiDeltaCard
                            label="Calls analyzed"
                            value={c?.totalAnalyzed ?? 0}
                            previous={p?.totalAnalyzed ?? 0}
                            digits={0}
                        />
                        <KpiDeltaCard
                            label="Avg caller rating"
                            value={c?.avgCallerSelfGoalRating ?? null}
                            previous={p?.avgCallerSelfGoalRating ?? null}
                            suffix="/10"
                        />
                        <KpiDeltaCard
                            label="Avg call output"
                            value={c?.avgCallOutputRating ?? null}
                            previous={p?.avgCallOutputRating ?? null}
                            suffix="/10"
                        />
                        <KpiDeltaCard
                            label="Positive sentiment"
                            value={positivePct(c?.sentimentDistribution)}
                            previous={positivePct(p?.sentimentDistribution)}
                            digits={0}
                            suffix="%"
                        />
                    </div>
                )}
            </div>

            {/* Group 2 — day-to-day activity (dispositions + calling reach) */}
            <div className="flex flex-col gap-2">
                <span className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
                    Day-to-day activity
                </span>
                {curDisp.isLoading ? (
                    <div className="grid grid-cols-3 gap-3">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-24 animate-pulse rounded-lg bg-neutral-100" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        <KpiDeltaCard
                            label="Leads dispositioned"
                            value={actC.dispositioned}
                            previous={actP.dispositioned}
                            digits={0}
                        />
                        <KpiDeltaCard
                            label="Calls made"
                            value={actC.calls}
                            previous={actP.calls}
                            digits={0}
                        />
                        <KpiDeltaCard
                            label="Team reach"
                            value={actC.reach}
                            previous={actP.reach}
                            digits={0}
                            suffix="%"
                        />
                    </div>
                )}
            </div>

            {/* Whole-team qualitative coaching (weakest skills, themes, objections) */}
            <TeamCoachingSection
                instituteId={instituteId}
                fromMillis={current.from}
                toMillis={current.to}
            />
        </section>
    );
}

// ── Per-counsellor "what they can improve" (lazy, on expand) ──────────────────
function CoachingDrillIn({
    counsellorUserId,
    from,
    to,
}: {
    counsellorUserId: string;
    from: number;
    to: number;
}) {
    const { data, isLoading } = useQuery({
        queryKey: ['ai-intel-counsellor-coaching', counsellorUserId, from, to],
        queryFn: () => fetchCounsellorCoaching(counsellorUserId, from, to),
        staleTime: 60 * 1000,
    });

    if (isLoading)
        return <div className="p-3 text-caption text-neutral-400">Loading coaching…</div>;
    if (!data || data.totalAnalyzed === 0) {
        return (
            <div className="p-3 text-caption text-neutral-400">
                No analyzed calls in this range — no coaching for this rep yet.
            </div>
        );
    }
    const weakest = (data.qualityAverages ?? []).slice(0, 3);
    const tips = (data.topCoachingTips ?? []).slice(0, 3);
    return (
        <div className="flex flex-col gap-2 px-4 py-3">
            {weakest.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-caption">
                    <span className="font-medium text-neutral-600">Weakest skills:</span>
                    {weakest.map((q) => (
                        <span
                            key={q.key}
                            className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600"
                        >
                            {q.key.replace(/_/g, ' ')} ·{' '}
                            {q.avgScore == null ? '—' : q.avgScore.toFixed(1)}/10
                        </span>
                    ))}
                </div>
            )}
            {tips.length > 0 && (
                <ul className="space-y-1">
                    {tips.map((t, i) => (
                        <li
                            key={i}
                            className="flex items-start gap-1.5 text-caption text-neutral-700"
                        >
                            <Target className="mt-0.5 size-3.5 shrink-0 text-primary-400" />
                            <span>{t.text}</span>
                        </li>
                    ))}
                </ul>
            )}
            {weakest.length === 0 && tips.length === 0 && (
                <span className="text-caption text-neutral-400">
                    Not enough signal for coaching in this range.
                </span>
            )}
        </div>
    );
}

interface CounsellorRow {
    userId: string;
    name: string;
    analyzed: number;
    analyzedPrev: number;
    avgCaller: number | null;
    avgCallerPrev: number | null;
    avgOutput: number | null;
    avgOutputPrev: number | null;
    statusChanges: number;
    statusChangesPrev: number;
    reach: number | null;
    reachPrev: number | null;
}

const reach = (outcomes: Record<string, number>): number | null => {
    const dials = Object.values(outcomes).reduce((s, n) => s + n, 0);
    if (dials === 0) return null;
    return Math.round(((outcomes.COMPLETED ?? 0) / dials) * 100);
};

function reachTone(v: number | null): string {
    if (v == null) return 'text-neutral-400';
    if (v >= 40) return 'text-green-700';
    if (v >= 20) return 'text-amber-700';
    return 'text-red-600';
}

// One right-aligned metric column (value + its vs-previous delta). Fixed width so
// every counsellor card lines up under the shared header row.
function MetricCol({
    value,
    previous,
    digits = 0,
    suffix = '',
    tone,
}: {
    value: number | null;
    previous: number | null;
    digits?: number;
    suffix?: string;
    tone?: string;
}) {
    return (
        <div className="flex w-24 shrink-0 flex-col items-end">
            <span className={cn('font-medium', tone ?? 'text-neutral-900')}>
                {value == null ? '—' : `${value.toFixed(digits)}${suffix}`}
            </span>
            <Delta current={value} previous={previous} digits={digits} suffix={suffix} />
        </div>
    );
}

// ── Per-counsellor breakdown ──────────────────────────────────────────────────
function CounsellorBreakdown({
    instituteId,
    current,
    previous,
}: {
    instituteId: string;
    current: Win;
    previous: Win;
}) {
    // Rows are expanded by default (coaching visible without a click); a row is
    // open unless the user has explicitly collapsed it.
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const toggle = (userId: string) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });

    const curTeam = useQuery({
        queryKey: ['ai-intel-team', instituteId, current.from, current.to],
        queryFn: () => fetchTeamCallIntelligence(instituteId, current.from, current.to),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });
    const prevTeam = useQuery({
        queryKey: ['ai-intel-team', instituteId, previous.from, previous.to],
        queryFn: () => fetchTeamCallIntelligence(instituteId, previous.from, previous.to),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });
    const curDisp = useQuery({
        queryKey: ['ai-intel-disp', instituteId, current.fromDate, current.toDate],
        queryFn: () =>
            fetchDispositions({
                instituteId,
                fromDate: current.fromDate,
                toDate: current.toDate,
            }),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });
    const prevDisp = useQuery({
        queryKey: ['ai-intel-disp', instituteId, previous.fromDate, previous.toDate],
        queryFn: () =>
            fetchDispositions({
                instituteId,
                fromDate: previous.fromDate,
                toDate: previous.toDate,
            }),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });

    const rows: CounsellorRow[] = useMemo(() => {
        const map = new Map<string, CounsellorRow>();
        const ensure = (userId: string, name?: string | null): CounsellorRow => {
            let r = map.get(userId);
            if (!r) {
                r = {
                    userId,
                    name: name ?? userId,
                    analyzed: 0,
                    analyzedPrev: 0,
                    avgCaller: null,
                    avgCallerPrev: null,
                    avgOutput: null,
                    avgOutputPrev: null,
                    statusChanges: 0,
                    statusChangesPrev: 0,
                    reach: null,
                    reachPrev: null,
                };
                map.set(userId, r);
            } else if (name && r.name === userId) {
                r.name = name;
            }
            return r;
        };

        for (const s of curTeam.data?.perCounsellor ?? []) {
            const r = ensure(s.counsellorUserId);
            r.analyzed = s.totalAnalyzed;
            r.avgCaller = s.avgCallerSelfGoalRating ?? null;
            r.avgOutput = s.avgCallOutputRating ?? null;
        }
        for (const s of prevTeam.data?.perCounsellor ?? []) {
            const r = ensure(s.counsellorUserId);
            r.analyzedPrev = s.totalAnalyzed;
            r.avgCallerPrev = s.avgCallerSelfGoalRating ?? null;
            r.avgOutputPrev = s.avgCallOutputRating ?? null;
        }
        for (const d of curDisp.data?.rows ?? []) {
            if (d.user_id === 'SYSTEM') continue;
            ensure(d.user_id, d.name).statusChanges = d.total_changes;
        }
        for (const d of prevDisp.data?.rows ?? []) {
            if (d.user_id === 'SYSTEM') continue;
            ensure(d.user_id, d.name).statusChangesPrev = d.total_changes;
        }
        for (const c of curDisp.data?.call_outcomes ?? []) {
            if (c.user_id === 'SYSTEM') continue;
            ensure(c.user_id, c.name).reach = reach(c.outcomes);
        }
        for (const c of prevDisp.data?.call_outcomes ?? []) {
            if (c.user_id === 'SYSTEM') continue;
            ensure(c.user_id, c.name).reachPrev = reach(c.outcomes);
        }
        return Array.from(map.values()).sort(
            (a, b) => b.analyzed - a.analyzed || b.statusChanges - a.statusChanges
        );
    }, [curTeam.data, prevTeam.data, curDisp.data, prevDisp.data]);

    const loading =
        curTeam.isLoading || prevTeam.isLoading || curDisp.isLoading || prevDisp.isLoading;

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <ChartLineUp size={18} className="text-primary-500" />
                <h2 className="text-h3 font-semibold text-neutral-800">Counsellor breakdown</h2>
                <span className="text-caption text-neutral-400">
                    metrics vs the previous equal period
                </span>
            </div>
            {loading ? (
                <div className="h-40 animate-pulse rounded-lg bg-neutral-100" />
            ) : rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-body text-neutral-400">
                    No counsellor activity in this period.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <div className="flex min-w-max flex-col gap-3">
                        {/* Shared column header — aligns with each card's metric row */}
                        <div className="flex items-center px-4 text-caption uppercase tracking-wide text-neutral-500">
                            <span className="w-6 shrink-0" />
                            <span className="min-w-40 flex-1">Counsellor</span>
                            <span className="w-24 shrink-0 text-right">Analyzed</span>
                            <span className="w-24 shrink-0 text-right">Avg caller</span>
                            <span className="w-24 shrink-0 text-right">Avg output</span>
                            <span className="w-24 shrink-0 text-right">Dispositioned</span>
                            <span className="w-24 shrink-0 text-right">Reach</span>
                        </div>

                        {rows.map((r) => {
                            const open = !collapsed.has(r.userId);
                            return (
                                // One card per counsellor — everything inside belongs to this
                                // rep, and the gap-3 between cards keeps them clearly apart.
                                <div
                                    key={r.userId}
                                    className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
                                >
                                    <div
                                        className={cn(
                                            'flex cursor-pointer items-center px-4 py-3 hover:bg-neutral-50',
                                            open && 'bg-neutral-50/60'
                                        )}
                                        onClick={() => toggle(r.userId)}
                                    >
                                        <span className="w-6 shrink-0 text-neutral-400">
                                            {open ? (
                                                <CaretDown size={14} />
                                            ) : (
                                                <CaretRight size={14} />
                                            )}
                                        </span>
                                        <span className="min-w-40 flex-1 font-medium text-neutral-800">
                                            {r.name}
                                        </span>
                                        <MetricCol value={r.analyzed} previous={r.analyzedPrev} />
                                        <MetricCol
                                            value={r.avgCaller}
                                            previous={r.avgCallerPrev}
                                            digits={1}
                                        />
                                        <MetricCol
                                            value={r.avgOutput}
                                            previous={r.avgOutputPrev}
                                            digits={1}
                                        />
                                        <MetricCol
                                            value={r.statusChanges}
                                            previous={r.statusChangesPrev}
                                        />
                                        <MetricCol
                                            value={r.reach}
                                            previous={r.reachPrev}
                                            suffix="%"
                                            tone={reachTone(r.reach)}
                                        />
                                    </div>
                                    {open && (
                                        <div className="border-t border-neutral-200">
                                            <div className="flex items-center gap-1.5 bg-neutral-50 px-4 py-2 text-caption font-semibold uppercase tracking-wide text-neutral-500">
                                                <Lightbulb size={13} /> What they can improve
                                            </div>
                                            <CoachingDrillIn
                                                counsellorUserId={r.userId}
                                                from={current.from}
                                                to={current.to}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}

// ── Period control (preset pills + custom range) ─────────────────────────────
function PeriodControl({
    period,
    current,
    onChange,
}: {
    period: Period;
    current: Win;
    onChange: (p: Period) => void;
}) {
    const isCustom = period.kind === 'custom';
    const activeDays = period.kind === 'preset' ? period.days : null;
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const applyCustom = (f: string, t: string) => {
        if (!f || !t) return;
        const fromMs = new Date(f).getTime();
        const toMs = new Date(`${t}T23:59:59`).getTime();
        if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs < fromMs) return;
        onChange({ kind: 'custom', fromMs, toMs });
    };

    const pill = (active: boolean) =>
        cn(
            'rounded-full border px-3 py-1.5 text-caption font-medium transition-colors',
            active
                ? 'border-primary-500 bg-primary-500 text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
        );

    return (
        <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-1.5">
                {PRESETS.map((p) => (
                    <button
                        key={p.days}
                        type="button"
                        onClick={() => onChange({ kind: 'preset', days: p.days })}
                        className={pill(activeDays === p.days)}
                    >
                        {p.label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => {
                        setFrom(current.fromDate);
                        setTo(current.toDate);
                        onChange({ kind: 'custom', fromMs: current.from, toMs: current.to });
                    }}
                    className={pill(isCustom)}
                >
                    Custom
                </button>
            </div>
            {isCustom && (
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => {
                            setFrom(e.target.value);
                            applyCustom(e.target.value, to);
                        }}
                        className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-body text-neutral-800 focus:border-primary-500 focus:outline-none"
                        aria-label="Start date"
                    />
                    <span className="text-caption text-neutral-400">to</span>
                    <input
                        type="date"
                        value={to}
                        min={from}
                        onChange={(e) => {
                            setTo(e.target.value);
                            applyCustom(from, e.target.value);
                        }}
                        className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-body text-neutral-800 focus:border-primary-500 focus:outline-none"
                        aria-label="End date"
                    />
                </div>
            )}
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function AiIntelligencePage() {
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id ?? '';
    const enabled = useCallIntelligenceEnabled();
    // When the feature is off but the institute has previously-analyzed data, we
    // still show the historical insights (read-only) with an "off" banner.
    const hasData = useHasCallIntelligenceData(!enabled);
    const showContent = enabled || hasData;
    const [period, setPeriod] = useState<Period>({ kind: 'preset', days: 30 });

    const { current, previous } = useMemo(() => windowsFor(period), [period]);

    return (
        <div className="flex flex-col gap-6 p-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Sparkle size={22} className="text-primary-500" weight="fill" />
                        <h1 className="text-h2 font-semibold text-neutral-900">AI Intelligence</h1>
                    </div>
                    <p className="max-w-xl text-body text-neutral-500">
                        Calling quality and day-to-day activity over time — team first, then each
                        counsellor, with the change vs the previous period so you can see what
                        improved.
                    </p>
                </div>
                <PeriodControl period={period} current={current} onChange={setPeriod} />
            </header>

            {/* Feature is off but there's historical data — show it read-only and
                make clear no new calls are being analyzed. */}
            {instituteId && !enabled && hasData && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-caption text-amber-700">
                    <Sparkle size={16} weight="fill" className="mt-0.5 shrink-0 text-amber-500" />
                    <span>
                        Call Intelligence is turned off — no new calls are being analyzed. Showing
                        previously analyzed data. Enable it in Settings to resume analysis.
                    </span>
                </div>
            )}

            {/* Explicit current-vs-previous comparison so "improved" is unambiguous */}
            {instituteId && showContent && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-caption">
                    <span className="font-medium text-neutral-700">Comparing</span>
                    <span className="rounded-full bg-primary-50 px-2.5 py-1 font-medium text-primary-700">
                        {fmtRange(current)}
                    </span>
                    <span className="text-neutral-400">against previous</span>
                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-neutral-600">
                        {fmtRange(previous)}
                    </span>
                </div>
            )}

            {!instituteId ? (
                <div className="rounded-lg border border-dashed border-neutral-200 p-8 text-center text-body text-neutral-400">
                    Loading institute…
                </div>
            ) : !showContent ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-200 p-10 text-center">
                    <Sparkle size={28} className="text-neutral-300" />
                    <p className="text-body font-medium text-neutral-600">
                        AI Intelligence is turned off
                    </p>
                    <p className="max-w-md text-caption text-neutral-400">
                        Enable Call Intelligence in Settings to transcribe and analyze calls, then
                        this page will show team and per-counsellor trends.
                    </p>
                </div>
            ) : (
                <>
                    <TeamInsights instituteId={instituteId} current={current} previous={previous} />
                    <CounsellorBreakdown
                        instituteId={instituteId}
                        current={current}
                        previous={previous}
                    />
                </>
            )}
        </div>
    );
}
