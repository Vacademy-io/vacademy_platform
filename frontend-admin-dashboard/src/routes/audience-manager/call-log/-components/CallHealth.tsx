/**
 * Call health — the technical post-mortem for an AI call, in the Call Log row.
 *
 * Why this exists: diagnosing three founder-flagged calls took a forensic sweep
 * of ~140k log lines across 220 calls. The root causes (a wedged TTS socket that
 * left the caller in 10.4s of silence, caller answers deleted before the agent
 * ever saw them, replies killed before a single audio byte, false "sorry, I
 * missed that" re-asks) were all known to the bot at call time and simply never
 * carried anywhere. The voice bot now ships them as `diagnostics` on the
 * end-of-call report; this is the read side. The bar it is built to:
 * "would this have told me the answer in 10 seconds?"
 *
 * Two affordances:
 *   • {@link CallHealthCell} — a green/amber/red dot in the row, headline on hover.
 *   • {@link CallHealthSheet} — the full panel: verdict, what happened with the
 *     numbers behind it, timings, the deleted answers verbatim, raw JSON to copy.
 *
 * Both read `GET /v1/telephony/calls/{id}/detail`, which serves the verdict
 * (`diag_health` / `diag_faults` / `diag_headline_text`) to any dashboard viewer
 * but withholds the full `diagnostics` blob unless the caller holds
 * VIEW_CALL_NUMBERS — it carries verbatim caller speech. The sheet renders that
 * middle state explicitly instead of pretending there is no report.
 *
 * HONESTY RULES (non-negotiable, they are the whole point):
 *   • A missing verdict renders NEUTRAL, never green. Absence of data is not health.
 *   • `answersDeleted === null` is NOT MEASURED and is rendered as such, never 0.
 *   • Inferred faults (LIKELY_MACHINE, FALSE_REASK) are labelled as inferences.
 *
 * Internal-facing by design ("TTS socket wedge"), so both affordances are
 * admin-gated by the caller — see CallLogTab.
 */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CaretDown, Copy, WarningCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    CALL_FAULT_CODES,
    callDetailKey,
    fetchCallDetail,
    rowCallFaults,
    rowCallHealth,
    type CallDiagnostics,
    type CallHealth as CallHealthVerdict,
    type CallRow,
} from '../-services/call-log-service';

// ── Vocabulary (mirrors voice_bot_service/app/diagnostics.py) ───────────────

/**
 * The bot's `_HEADLINE_TEXT`. Duplicated here so a row can show its headline on
 * hover from `diag_faults` alone, without an N+1 detail fetch — the derivation
 * rule is identical (first fault in CALL_FAULT_CODES order, which IS the bot's
 * HEADLINE_PRIORITY). The sheet still prefers the bot's own `headlineText`.
 */
const HEADLINE_TEXT: Record<string, string> = {
    CRASH: 'Pipeline crashed mid-call',
    TTS_WEDGE: 'Voice synthesis stalled — caller heard silence',
    REPLY_UNPLAYED: 'A reply was never played to the caller',
    ANSWER_DELETED: 'Caller answers were discarded before the agent saw them',
    BOT_SILENT: 'The agent never spoke — the caller heard nothing',
    REPLY_LOOP: 'The agent kept restarting the same reply',
    HANDBACK_LOOP: 'The agent had nothing to say and kept asking the caller to talk',
    DEAD_AIR: 'Long silence during the call',
    FALSE_REASK: 'Agent re-asked for answers it had already heard',
    LIKELY_MACHINE: 'Probably an answering machine, not a person',
    STT_DEAF: 'Speech recognition reconnected mid-call',
    SLOW_TTS: 'Slow voice synthesis',
    SLOW_LLM: 'Slow agent responses',
    TRANSFER_FAILED: 'Human transfer was requested but failed',
    PROMPT_UNFILLED: 'Agent prompt has unresolved placeholders',
};

/** Short label for chips and lists (the headline sentence is the long form). */
const FAULT_LABEL: Record<string, string> = {
    CRASH: 'Crash',
    TTS_WEDGE: 'TTS wedge',
    REPLY_UNPLAYED: 'Reply unplayed',
    ANSWER_DELETED: 'Answers deleted',
    BOT_SILENT: 'Agent silent',
    REPLY_LOOP: 'Reply loop',
    HANDBACK_LOOP: 'Nothing to say',
    DEAD_AIR: 'Dead air',
    FALSE_REASK: 'False re-ask',
    LIKELY_MACHINE: 'Likely machine',
    STT_DEAF: 'STT deaf',
    SLOW_TTS: 'Slow TTS',
    SLOW_LLM: 'Slow LLM',
    TRANSFER_FAILED: 'Transfer failed',
    PROMPT_UNFILLED: 'Prompt unfilled',
};

/**
 * Faults derived from a heuristic rather than a measurement — the bot marks the
 * machine block `src: "inferred"`, and a "false" re-ask is a judgement about
 * timing, not an observed fact. Shown with an explicit tag so nobody quotes them
 * as measurements.
 */
const INFERRED_FAULTS = new Set<string>(['LIKELY_MACHINE', 'FALSE_REASK']);

const HEALTH_TONE: Record<
    CallHealthVerdict | 'UNKNOWN',
    { dot: string; chip: string; label: string }
> = {
    GREEN: { dot: 'bg-success-500', chip: 'bg-success-50 text-success-700', label: 'Healthy' },
    AMBER: { dot: 'bg-warning-500', chip: 'bg-warning-50 text-warning-700', label: 'Degraded' },
    RED: { dot: 'bg-danger-500', chip: 'bg-danger-50 text-danger-600', label: 'Broken' },
    // Grey, NEVER green: we did not measure this call, which is not the same as
    // the call being fine.
    UNKNOWN: {
        dot: 'bg-neutral-300',
        chip: 'bg-neutral-100 text-neutral-600',
        label: 'Not reported',
    },
};

const NOT_REPORTED_HINT =
    'Call health not reported — this call ran before diagnostics shipped, or the bot sent no verdict.';

// ── Pure formatting / evidence helpers ─────────────────────────────────────

function secs(v: number | null | undefined): string | null {
    if (v == null || Number.isNaN(v)) return null;
    return `${v < 1 ? v.toFixed(2) : v.toFixed(1)}s`;
}

/** "3 stalls" / "1 stall" / null when zero or unknown (nothing to say). */
function count(n: number | null | undefined, one: string, many?: string): string | null {
    if (n == null || n <= 0) return null;
    return `${n} ${n === 1 ? one : many ?? `${one}s`}`;
}

/** Faults in the bot's headline priority order; unknown (newer-bot) codes last. */
export function orderedFaults(faults: string[]): string[] {
    const known = CALL_FAULT_CODES.filter((c) => faults.includes(c)) as string[];
    const unknown = faults.filter((f) => !(CALL_FAULT_CODES as readonly string[]).includes(f));
    return [...known, ...unknown];
}

/** The bot's headline rule, applied to a row that only carries its fault codes. */
function deriveHeadlineText(faults: string[]): string | null {
    const first = orderedFaults(faults)[0];
    return first ? HEADLINE_TEXT[first] ?? first : null;
}

/**
 * The specific numbers behind a fired fault — "TTS_WEDGE: 3 stalls, 1 wedge,
 * worst dead air 10.4s". Without these the chip is just a mood.
 */
function faultEvidence(code: string, d: CallDiagnostics): string[] {
    const tts = d.tts ?? {};
    const playout = d.playout ?? {};
    const turn = d.turnTaking ?? {};
    const latency = d.latency ?? {};
    const machine = d.machine ?? {};
    const infra = d.infra ?? {};
    const out: (string | null)[] = [];

    switch (code) {
        case 'CRASH':
            out.push(infra.crash ? `error: ${infra.crash}` : null);
            break;
        case 'TTS_WEDGE':
            out.push(
                count(tts.stalls, 'stall'),
                count(tts.wedges, 'wedge'),
                count(tts.wedgeReconnects, 'socket rebuild'),
                count(tts.silentGenerations, 'silent generation'),
                count(tts.letterlessSkipped, 'letterless chunk skipped'),
                tts.stallCapHit ? 'stall cap hit — silent from then on' : null,
                latency.deadAirMax != null ? `worst dead air ${secs(latency.deadAirMax)}` : null
            );
            break;
        case 'REPLY_UNPLAYED':
            out.push(
                playout.repliesNeverPlayed != null
                    ? `${playout.repliesNeverPlayed} of ${playout.repliesGenerated ?? '?'} replies never reached the caller`
                    : null
            );
            break;
        case 'ANSWER_DELETED':
            out.push(
                turn.answersDeleted == null
                    ? 'not measured on this call'
                    : count(
                          turn.answersDeleted,
                          'caller answer discarded',
                          'caller answers discarded'
                      ),
                turn.answersDeletedSamples?.length
                    ? `${turn.answersDeletedSamples.length} captured verbatim (below)`
                    : null
            );
            break;
        case 'HANDBACK_LOOP':
            out.push(
                turn.handbacks
                    ? count(turn.handbacks, 'turn answered with “you talk”', 'turns answered with “you talk”')
                    : null,
                turn.repeatsSuppressed
                    ? `${turn.repeatsSuppressed} sentence(s) suppressed as already-said`
                    : null,
                turn.repeatEscalations
                    ? `${turn.repeatEscalations} said anyway to break the loop`
                    : null
            );
            break;
        case 'REPLY_LOOP':
            out.push(
                turn.maxReplyRestarts != null
                    ? `same reply restarted ${turn.maxReplyRestarts}x in a row`
                    : null,
                turn.repeatsSuppressed
                    ? `${turn.repeatsSuppressed} repeated line(s) suppressed`
                    : null
            );
            break;
        case 'BOT_SILENT':
            out.push('the agent produced no audio at all');
            break;
        case 'DEAD_AIR':
            out.push(
                latency.deadAirMax != null ? `worst gap ${secs(latency.deadAirMax)}` : null,
                latency.deadAirP95 != null ? `p95 ${secs(latency.deadAirP95)}` : null
            );
            break;
        case 'FALSE_REASK':
            out.push(
                turn.orphanFalseReasks != null
                    ? `${turn.orphanFalseReasks} of ${turn.orphanReasks ?? '?'} re-asks fired after the answer had already landed`
                    : null
            );
            break;
        case 'LIKELY_MACHINE':
            out.push(
                machine.score != null ? `score ${machine.score}` : null,
                machine.markers?.length ? `markers: ${machine.markers.join(', ')}` : null,
                machine.firstUserSecs != null
                    ? `first caller audio ${secs(machine.firstUserSecs)}`
                    : null,
                machine.longestUserSecs != null
                    ? `longest caller turn ${secs(machine.longestUserSecs)}`
                    : null,
                count(turn.userTurns, 'caller turn'),
                turn.bargeIns === 0 ? 'no barge-ins' : count(turn.bargeIns, 'barge-in')
            );
            break;
        case 'STT_DEAF':
            out.push(count(infra.sttReconnects, 'speech-recognition reconnect'));
            break;
        case 'SLOW_TTS':
            out.push(
                tts.ttfbP50 != null ? `p50 ${secs(tts.ttfbP50)}` : null,
                tts.ttfbP95 != null ? `p95 ${secs(tts.ttfbP95)}` : null,
                tts.ttfbMax != null ? `max ${secs(tts.ttfbMax)}` : null
            );
            break;
        case 'SLOW_LLM':
            out.push(
                latency.llmTtfbP50 != null ? `p50 ${secs(latency.llmTtfbP50)}` : null,
                latency.llmTtfbP95 != null ? `p95 ${secs(latency.llmTtfbP95)}` : null
            );
            break;
        case 'TRANSFER_FAILED':
            out.push('transfer requested, never registered with the provider');
            break;
        case 'PROMPT_UNFILLED':
            out.push(
                infra.promptUnfilled?.length
                    ? `unresolved: ${infra.promptUnfilled.join(', ')}`
                    : null
            );
            break;
        default:
            break;
    }
    return out.filter((x): x is string => !!x);
}

// ── Row affordance ─────────────────────────────────────────────────────────

function HealthDot({
    health,
    className,
}: {
    health: CallHealthVerdict | null;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'inline-block size-2.5 shrink-0 rounded-full',
                HEALTH_TONE[health ?? 'UNKNOWN'].dot,
                className
            )}
        />
    );
}

/**
 * The Call Log's health column: a dot with the headline on hover, opening the
 * full sheet on click. Only AI calls carry diagnostics — human calls show a dash
 * rather than a permanently grey dot, which would read as a fleet-wide fault.
 *
 * The verdict lives on the per-call detail endpoint, not on the search row, and
 * 25 detail fetches per page to colour 25 dots is not a trade worth making. So
 * the cell reads the detail query's CACHE only (`enabled: false` — it subscribes,
 * it never fetches): a row whose detail was already pulled — by this sheet, or by
 * the status popover, which shares the key — colours itself in, and every other
 * row honestly says "not reported" until asked. If the search row ever starts
 * carrying `diag_health`, that wins and no fetch is involved at all.
 */
export function CallHealthCell({
    instituteId,
    row,
    onOpen,
}: {
    instituteId: string;
    row: CallRow;
    onOpen: () => void;
}) {
    const cached = useQuery({
        queryKey: callDetailKey(instituteId, row.id),
        queryFn: () => fetchCallDetail(instituteId, row.id),
        enabled: false, // cache subscription only — never fires a request
        staleTime: 60_000,
        retry: false,
    });

    if (row.call_type !== 'AI') {
        return (
            <span
                className="text-xs text-neutral-400"
                title="Only AI calls report technical health"
            >
                —
            </span>
        );
    }

    const detail = cached.data;
    const health = rowCallHealth(row) ?? detail?.diagnostics?.health ?? rowCallHealth(detail ?? {});
    const faults = orderedFaults(
        firstNonEmpty(
            rowCallFaults(row),
            detail?.diagnostics?.faults ?? [],
            rowCallFaults(detail ?? {})
        )
    );
    const tone = HEALTH_TONE[health ?? 'UNKNOWN'];
    const headline = detail?.diag_headline_text ?? deriveHeadlineText(faults);

    // Three greys, and they are NOT the same claim: we have a verdict; we asked
    // and there was none; we have not asked yet. Labelling the third "not
    // reported" would be the exact dishonesty this panel exists to end.
    const label = health ? headline ?? tone.label : detail ? tone.label : 'Check health';
    const title = health
        ? `${tone.label}${headline ? ` — ${headline}` : ' — no faults detected'}. Click for technical details.`
        : detail
          ? NOT_REPORTED_HINT
          : 'Technical report not loaded for this row — click to fetch this call’s health.';

    return (
        <button
            type="button"
            onClick={onOpen}
            title={title}
            aria-label={`Call health: ${health ? tone.label : label}`}
            className="inline-flex max-w-40 items-center gap-1.5 rounded-full px-1 py-0.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
            <HealthDot health={health} />
            {/* min-w-0 so the headline truncates inside the flex row instead of overflowing. */}
            <span className="min-w-0 truncate">{label}</span>
        </button>
    );
}

/** Chip tone for a fault whose level may not have been served. */
function faultChipTone(level: string | undefined): string {
    if (level === 'RED') return HEALTH_TONE.RED.chip;
    if (level === 'AMBER') return HEALTH_TONE.AMBER.chip;
    return HEALTH_TONE.UNKNOWN.chip;
}

/** First list with anything in it — used to pick the best-populated fault source. */
function firstNonEmpty(...lists: (string[] | null | undefined)[]): string[] {
    for (const l of lists) {
        if (l && l.length) return l;
    }
    return [];
}

// ── Sheet ──────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: ReactNode }) {
    return (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {children}
        </h3>
    );
}

function InferredTag() {
    return (
        <span
            className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-caption font-medium text-neutral-600"
            title="Inferred from a heuristic, not measured. Treat as evidence, not fact."
        >
            inferred
        </span>
    );
}

/**
 * One number. An absent value is spelled out ("not measured"), never shown as 0
 * or blank — the whole panel is worthless if you can't tell the difference
 * between "we looked and it was fine" and "we never looked".
 */
function Stat({
    label,
    value,
    empty = 'not measured',
}: {
    label: string;
    value: string | null;
    empty?: string;
}) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-caption uppercase tracking-wide text-neutral-500">{label}</span>
            <span
                className={cn(
                    'text-sm font-medium',
                    value ? 'text-neutral-800' : 'text-neutral-400'
                )}
            >
                {value ?? empty}
            </span>
        </div>
    );
}

function FaultBlock({
    code,
    level,
    d,
    withheld = false,
}: {
    code: string;
    level: string | undefined;
    d: CallDiagnostics;
    /** Numbers exist but this role may not see them (no VIEW_CALL_NUMBERS). */
    withheld?: boolean;
}) {
    // WITHHELD IS NOT "NOT MEASURED". In summary-only mode `d` is empty, so every
    // evidence line would fall through to its absent-value copy and print
    // "not measured on this call" — while the fault FIRING proves the opposite
    // (a live call reported ANSWER_DELETED with 14 deleted answers and the sheet
    // still said "not measured"). Suppress the lines instead of asserting
    // something false; the sheet already explains the withholding once, globally.
    const evidence = withheld ? [] : faultEvidence(code, d);
    const tone = level === 'RED' ? HEALTH_TONE.RED : HEALTH_TONE.AMBER;
    return (
        <div className="flex flex-col gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
                {/* No pill when the per-fault level wasn't served — guessing AMBER
                    would quietly downgrade a RED. */}
                {level && (
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-caption font-semibold',
                            tone.chip
                        )}
                    >
                        {level}
                    </span>
                )}
                <span className="text-sm font-semibold text-neutral-900">
                    {FAULT_LABEL[code] ?? code}
                </span>
                <span className="text-caption text-neutral-400">{code}</span>
                {INFERRED_FAULTS.has(code) && <InferredTag />}
            </div>
            <p className="text-sm text-neutral-600">
                {HEADLINE_TEXT[code] ??
                    'Unrecognised fault code — this call was reported by a newer bot than this dashboard knows about.'}
            </p>
            {evidence.length > 0 && (
                <p className="text-xs text-neutral-500">{evidence.join(' · ')}</p>
            )}
        </div>
    );
}

/** Verbatim caller answers the aggregator dropped — the highest-signal block here. */
function DeletedAnswers({ d }: { d: CallDiagnostics }) {
    const turn = d.turnTaking ?? {};
    const deleted = turn.answersDeleted;
    const samples = turn.answersDeletedSamples ?? [];

    return (
        <section className="flex flex-col gap-2">
            <SectionTitle>Caller answers discarded</SectionTitle>
            {deleted == null ? (
                // NOT MEASURED. Rendering this as "0" is how a fleet chart claims
                // "fixed" about something that was never looked at.
                <p className="text-sm text-neutral-400">
                    not measured on this call
                    <span className="ml-1 text-neutral-400">
                        (the bot did not reconcile what it heard against what the agent received)
                    </span>
                </p>
            ) : deleted === 0 ? (
                <p className="text-sm text-neutral-600">
                    None — every caller answer reached the agent.
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    {/* "or the transcript or the report" was wrong: the bot derives
                        these very samples FROM the transcript it posts, so a discarded
                        answer is always in both. What it never reached is the MODEL,
                        which is why nothing in the call could respond to it. */}
                    <p className="text-sm text-neutral-700">
                        <span className="font-semibold text-danger-600">{deleted}</span> answer
                        {deleted === 1 ? '' : 's'} reached the transcript but never the agent, so
                        nothing in the call could respond to {deleted === 1 ? 'it' : 'them'}.
                    </p>
                    {samples.length > 0 && (
                        <ul className="flex flex-col gap-1">
                            {samples.map((s, i) => (
                                <li
                                    key={`${i}-${s}`}
                                    className="rounded-sm border border-danger-100 bg-danger-50 px-2 py-1 text-sm text-neutral-800"
                                >
                                    &ldquo;{s}&rdquo;
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            <LostFragments turn={turn} />
        </section>
    );
}

/**
 * Sub-word scraps lost the same way as a discarded answer, shown SEPARATELY and
 * without a fault colour. Until rules v3 these were counted as discarded answers:
 * a live call went AMBER on one lost final whose entire text was "वो।", and the
 * panel told the founder an ANSWER had been lost, which sent them looking for an
 * answer nobody ever gave. Hidden entirely would be the other failure — a
 * measured loss must stay on the page — so it is reported as what it is.
 */
function LostFragments({ turn }: { turn: NonNullable<CallDiagnostics['turnTaking']> }) {
    const lost = turn.fragmentsLost;
    if (lost == null || lost === 0) return null;
    const samples = turn.fragmentsLostSamples ?? [];
    return (
        <div className="flex flex-col gap-1 border-t border-neutral-100 pt-2">
            <p className="text-xs text-neutral-500">
                Also lost: {lost} part-word scrap{lost === 1 ? '' : 's'} too small to have
                carried an answer (a syllable of something the caller broke off). Not counted
                as a discarded answer.
            </p>
            {samples.length > 0 && (
                <p className="text-xs text-neutral-600">
                    {samples.map((s) => `“${s}”`).join(' · ')}
                </p>
            )}
        </div>
    );
}

function RawJsonBlock({ diagnostics }: { diagnostics: CallDiagnostics }) {
    const json = JSON.stringify(diagnostics, null, 2);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(json);
            toast.success('Diagnostics JSON copied');
        } catch {
            toast.error('Could not copy — select the text and copy manually.');
        }
    };
    return (
        <details className="rounded-md border border-neutral-200">
            <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-600">
                <CaretDown size={12} weight="bold" />
                Raw diagnostics JSON
            </summary>
            <div className="flex flex-col gap-2 border-t border-neutral-200 p-3">
                <div>
                    <MyButton buttonType="secondary" scale="small" onAsyncClick={copy}>
                        <span className="flex items-center gap-1.5">
                            <Copy size={14} />
                            Copy for an engineer
                        </span>
                    </MyButton>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-sm bg-neutral-50 p-2 text-caption text-neutral-600">
                    {json}
                </pre>
            </div>
        </details>
    );
}

/**
 * "Call health" panel. Loads the per-call detail (same endpoint + query key the
 * status popover uses, so it is often a cache hit) and reads `diagnostics`.
 * Degrades in three steps, each of which says which one it is:
 *   1. full blob — verdict, faults with their numbers, timings, deleted answers, JSON;
 *   2. summary only — verdict + fault list, numbers withheld for this role;
 *   3. nothing — no technical report for this call.
 */
export function CallHealthSheet({
    instituteId,
    call,
    onClose,
}: {
    instituteId: string;
    call: CallRow | null;
    onClose: () => void;
}) {
    const detailQuery = useQuery({
        queryKey: callDetailKey(instituteId, call?.id ?? ''),
        queryFn: () => fetchCallDetail(instituteId, call!.id),
        enabled: !!call,
        staleTime: 60_000,
        retry: false,
    });

    const detail = detailQuery.data ?? null;
    const d = detail?.diagnostics ?? null;
    // Verdict ladder: full blob → the summary fields every viewer gets → the row.
    const health = d?.health ?? rowCallHealth(detail ?? {}) ?? (call ? rowCallHealth(call) : null);
    const tone = HEALTH_TONE[health ?? 'UNKNOWN'];
    const faults = orderedFaults(
        firstNonEmpty(d?.faults, rowCallFaults(detail ?? {}), call ? rowCallFaults(call) : [])
    );
    const rulesVersion = d?.rulesVersion ?? detail?.diag_rules_version ?? null;
    const headlineText =
        d?.headlineText ??
        detail?.diag_headline_text ??
        deriveHeadlineText(faults) ??
        (health === 'GREEN' ? 'No faults detected' : null);
    /** Verdict known, but the numbers behind it withheld (no VIEW_CALL_NUMBERS). */
    const summaryOnly = !d && (health != null || faults.length > 0);
    const latency = d?.latency ?? {};
    const tts = d?.tts ?? {};
    const setup = d?.setup ?? {};
    const turn = d?.turnTaking ?? {};
    const playout = d?.playout ?? {};
    const infra = d?.infra ?? {};

    return (
        <Sheet
            open={!!call}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl"
            >
                <SheetHeader>
                    <SheetTitle className="text-base">Call health</SheetTitle>
                    <SheetDescription className="text-xs">
                        Technical post-mortem for this call. Internal debugging detail — not
                        lead-facing.
                    </SheetDescription>
                </SheetHeader>

                {/* Verdict — the 10-second answer. */}
                <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4">
                    <div className="flex items-center gap-2">
                        <HealthDot health={health} className="size-3" />
                        <span className="text-lg font-bold tracking-tight text-neutral-900">
                            {detailQuery.isLoading ? 'CHECKING…' : health ?? 'NOT REPORTED'}
                        </span>
                        {health && <span className="text-xs text-neutral-500">{tone.label}</span>}
                    </div>
                    <p className="text-sm text-neutral-700">
                        {detailQuery.isLoading
                            ? 'Loading diagnostics…'
                            : headlineText ?? NOT_REPORTED_HINT}
                    </p>
                    {faults.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {faults.map((f) => (
                                <span
                                    key={f}
                                    title={HEADLINE_TEXT[f] ?? f}
                                    className={cn(
                                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                        // Neutral when per-fault levels weren't served, so an
                                        // unknown level never reads as the milder one.
                                        faultChipTone(d?.faultLevels?.[f])
                                    )}
                                >
                                    {FAULT_LABEL[f] ?? f}
                                    {INFERRED_FAULTS.has(f) && (
                                        <span className="text-caption font-normal opacity-70">
                                            inferred
                                        </span>
                                    )}
                                </span>
                            ))}
                        </div>
                    )}
                    {call && (
                        <p className="text-caption text-neutral-400">
                            {call.lead_name || call.lead_number || 'Lead'} · call {call.id}
                            {rulesVersion != null && ` · rules v${rulesVersion}`}
                        </p>
                    )}
                </section>

                {detailQuery.isLoading ? (
                    <div className="h-40 animate-pulse rounded-lg bg-neutral-100" />
                ) : summaryOnly ? (
                    // The verdict is public; the numbers behind it are not. Say which,
                    // so "no detail" is never mistaken for "nothing happened".
                    <section className="flex flex-col gap-2">
                        <SectionTitle>What happened</SectionTitle>
                        {faults.map((f) => (
                            <FaultBlock key={f} code={f} level={undefined} d={{}} withheld />
                        ))}
                        <p className="rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-500">
                            The numbers behind this verdict — timings, counters and the discarded
                            caller answers — are withheld for your role: they include verbatim
                            caller speech. They need the same permission as unmasked phone numbers
                            (VIEW_CALL_NUMBERS).
                        </p>
                    </section>
                ) : !d ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-300 p-6 text-center">
                        <WarningCircle size={24} className="text-neutral-400" />
                        <p className="text-sm font-medium text-neutral-700">
                            No technical report for this call
                        </p>
                        <p className="max-w-sm text-xs text-neutral-500">
                            {detailQuery.isError
                                ? 'The call detail could not be loaded, so no diagnostics are available.'
                                : 'Diagnostics are recorded by the AI voice agent from rules v1 onward. Calls placed before it shipped, and human calls, have nothing to show here.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* What happened — fired faults, in priority order, with numbers. */}
                        <section className="flex flex-col gap-2">
                            <SectionTitle>What happened</SectionTitle>
                            {faults.length === 0 ? (
                                <p className="text-sm text-neutral-600">
                                    No faults fired. Every rule in v{d.rulesVersion ?? 1} stayed
                                    under threshold.
                                </p>
                            ) : (
                                faults.map((f) => (
                                    <FaultBlock key={f} code={f} level={d.faultLevels?.[f]} d={d} />
                                ))
                            )}
                            {d.error && (
                                <p className="text-xs text-danger-600">
                                    The bot&apos;s own diagnostics build failed ({d.error}) — the
                                    numbers below may be incomplete.
                                </p>
                            )}
                        </section>

                        {/* Deleted answers — verbatim when present. */}
                        <DeletedAnswers d={d} />

                        {/* Timings. */}
                        <section className="flex flex-col gap-2">
                            <SectionTitle>Timings</SectionTitle>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <Stat label="LLM ttfb p50" value={secs(latency.llmTtfbP50)} />
                                <Stat label="LLM ttfb p95" value={secs(latency.llmTtfbP95)} />
                                <Stat label="TTS ttfb p50" value={secs(tts.ttfbP50)} />
                                <Stat label="TTS ttfb p95" value={secs(tts.ttfbP95)} />
                                <Stat label="STT ttfb p50" value={secs(latency.sttTtfbP50)} />
                                <Stat label="STT ttfb p95" value={secs(latency.sttTtfbP95)} />
                                <Stat label="Dead air p95" value={secs(latency.deadAirP95)} />
                                <Stat label="Worst dead air" value={secs(latency.deadAirMax)} />
                                <Stat
                                    label="Greet path"
                                    value={setup.greetPath ?? null}
                                    empty="not reported"
                                />
                                <Stat
                                    label="Greet delay"
                                    value={secs(setup.greetDelaySecs)}
                                    empty="not reported"
                                />
                                <Stat
                                    label="Setup"
                                    value={secs(setup.setupSecs)}
                                    empty="not reported"
                                />
                            </div>
                        </section>

                        {/* Raw counters, for the questions the faults didn't answer. */}
                        <section className="flex flex-col gap-2">
                            <SectionTitle>Signals</SectionTitle>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <Stat label="Caller turns" value={fmtCount(turn.userTurns)} />
                                <Stat label="Agent turns" value={fmtCount(turn.botTurns)} />
                                <Stat label="Barge-ins" value={fmtCount(turn.bargeIns)} />
                                <Stat label="Nudges" value={fmtCount(turn.nudges)} />
                                <Stat
                                    label="Replies played"
                                    value={
                                        playout.repliesGenerated == null
                                            ? null
                                            : `${playout.repliesGenerated - (playout.repliesNeverPlayed ?? 0)} of ${playout.repliesGenerated}`
                                    }
                                />
                                <Stat label="TTS stalls" value={fmtCount(tts.stalls)} />
                                <Stat label="TTS wedges" value={fmtCount(tts.wedges)} />
                                <Stat
                                    label="STT reconnects"
                                    value={fmtCount(infra.sttReconnects)}
                                />
                                <Stat label="Ended by" value={endedBy(turn)} empty="not reported" />
                            </div>
                            {d.machine && (
                                <p className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                                    <span>Answering-machine score {d.machine.score ?? '—'}</span>
                                    {d.machine.src === 'inferred' && <InferredTag />}
                                    {d.machine.markers?.length ? (
                                        <span>· markers: {d.machine.markers.join(', ')}</span>
                                    ) : null}
                                </p>
                            )}
                        </section>

                        <RawJsonBlock diagnostics={d} />
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}

/** Counters are measured or absent — 0 is a real answer, undefined is not. */
function fmtCount(n: number | null | undefined): string | null {
    return n == null ? null : String(n);
}

/** How the call terminated, when the bot reported either termination flag. */
function endedBy(turn: NonNullable<CallDiagnostics['turnTaking']>): string | null {
    if (turn.idleHangup) return 'idle hang-up';
    if (turn.capFarewell) return 'turn cap';
    if (turn.idleHangup == null && turn.capFarewell == null) return null;
    return 'normal end';
}
