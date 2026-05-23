/**
 * Single scan-candidate card. Shows enough signal for the user to decide
 * whether this clip is worth previewing:
 *
 *   - Thumbnail (from backend's async `thumbnail_strip_url`; placeholder
 *     if it hasn't landed yet — backend generates these in the background
 *     after /scan returns)
 *   - Timestamp range in source (e.g. "12:40 → 13:35")
 *   - 5-axis score bars (Hook / Pacing / Info / Loop / Topic) — research
 *     §12.4 says transparency in scoring beats Opus's single opaque number.
 *     Topic added 2026-05-22 (A3) — TF-IDF concentration axis.
 *   - Composite score as a big number
 *   - **Quality chips** (added 2026-05-22, A5) — six small color-coded
 *     pills surfacing breakdown signals without expanding tooltips: start
 *     opener, end terminator, silence%, face%, speaker moves, info density.
 *     Users filter visually instead of trusting the single composite.
 *   - **LLM rerank reason** (added 2026-05-22, A2) — italic quote of the
 *     Haiku rerank pass's per-candidate critique, shown BEFORE /preview
 *     is called so the user has a "why this clip" justification up front.
 *   - Transcript snippet (first sentence … last sentence)
 *   - Low-confidence badge when composite < 60
 *   - Checkbox for multi-select
 */
import { Check, Film, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReelCandidate } from '../services/reels-api';

interface ReelCandidateCardProps {
    candidate: ReelCandidate;
    selected: boolean;
    onToggle: () => void;
}

export function ReelCandidateCard({
    candidate,
    selected,
    onToggle,
}: ReelCandidateCardProps) {
    const start = formatTimestamp(candidate.source_t_start);
    const end = formatTimestamp(candidate.source_t_end);
    const predicted = `${candidate.predicted_output_duration_s.toFixed(1)}s`;

    return (
        <button
            type="button"
            onClick={onToggle}
            className={cn(
                'group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left transition-all',
                selected
                    ? 'border-neutral-900 shadow-md ring-2 ring-neutral-900'
                    : 'border-neutral-200 hover:border-neutral-400'
            )}
            aria-pressed={selected}
        >
            <div className="relative aspect-video w-full bg-neutral-100">
                {candidate.thumbnail_strip_url ? (
                    <img
                        src={candidate.thumbnail_strip_url}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                    />
                ) : (
                    <div className="flex size-full items-center justify-center text-neutral-400">
                        <Film className="size-8" />
                    </div>
                )}

                {/* Selection checkbox — overlay top-left */}
                <span
                    className={cn(
                        'absolute left-2 top-2 inline-flex size-6 items-center justify-center rounded-md border transition-colors',
                        selected
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-white/80 bg-black/40 text-transparent backdrop-blur-sm group-hover:bg-black/60'
                    )}
                >
                    <Check className="size-4" />
                </span>

                {/* Composite score — overlay top-right */}
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-bold text-white backdrop-blur-sm">
                    {Math.round(candidate.score.composite)}
                </span>

                {/* Predicted output duration — overlay bottom-right */}
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
                    <Scissors className="size-3" />
                    {predicted}
                </span>

                {/* Low-confidence badge */}
                {candidate.low_confidence && (
                    <span className="absolute bottom-2 left-2 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Low confidence
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-2.5 p-3.5">
                <p className="text-xs font-medium text-neutral-500">
                    {start} → {end}
                </p>

                {/* 5-axis bars — gives the user a feel for *why* this clip scored
                    the way it did without needing to expand a tooltip. */}
                <div className="grid grid-cols-5 gap-1.5">
                    <ScoreBar label="Hook" value={candidate.score.hook} />
                    <ScoreBar label="Pacing" value={candidate.score.pacing} />
                    <ScoreBar label="Info" value={candidate.score.info} />
                    <ScoreBar label="Loop" value={candidate.score.loop} />
                    <ScoreBar label="Topic" value={candidate.score.topic ?? 0} />
                </div>

                <QualityChips breakdown={candidate.breakdown} />

                {candidate.breakdown.llm_rerank_reason && (
                    <p
                        className="line-clamp-2 rounded-md bg-neutral-50 px-2 py-1.5 text-[11px] italic leading-snug text-neutral-600"
                        title={candidate.breakdown.llm_rerank_reason}
                    >
                        &ldquo;{candidate.breakdown.llm_rerank_reason}&rdquo;
                    </p>
                )}

                <p className="line-clamp-3 text-xs leading-snug text-neutral-600">
                    {candidate.transcript_snippet || '(silent window)'}
                </p>
            </div>
        </button>
    );
}

/** A5 (2026-05-22) — color-coded pills surfacing breakdown signals so the
 *  user can filter visually instead of trusting one composite number.
 *  Each chip's tone is "good" (emerald), "neutral" (neutral), or "warn"
 *  (amber) based on calibrated thresholds. Skipped when the signal is
 *  None (e.g., screen-recording sources have no face_coverage). */
function QualityChips({
    breakdown,
}: {
    breakdown: ReelCandidate['breakdown'];
}) {
    const chips: { label: string; tone: 'good' | 'neutral' | 'warn'; title: string }[] = [];

    // Start opener: false = sentence-aligned (good), true = mid-sentence/filler.
    if (typeof breakdown.start_bad_opener === 'boolean') {
        chips.push({
            label: breakdown.start_bad_opener ? 'start: mid' : 'start: clean',
            tone: breakdown.start_bad_opener ? 'warn' : 'good',
            title: `Opens on "${breakdown.start_first_word ?? '?'}"`,
        });
    }

    // End terminator: 'punctuation' = clean end, 'continuator' = mid-thought, 'no_punct' = neutral.
    if (breakdown.end_terminator) {
        const e = breakdown.end_terminator;
        chips.push({
            label:
                e === 'punctuation'
                    ? 'end: punct'
                    : e === 'continuator'
                        ? 'end: mid'
                        : 'end: ok',
            tone: e === 'punctuation' ? 'good' : e === 'continuator' ? 'warn' : 'neutral',
            title: `Closes on "${breakdown.end_last_word ?? '?'}" (${e})`,
        });
    }

    // Silence fraction: < 20% good, 20-40% neutral, > 40% warn.
    if (typeof breakdown.silence_fraction === 'number') {
        const s = breakdown.silence_fraction;
        const pct = Math.round(s * 100);
        chips.push({
            label: `silence: ${pct}%`,
            tone: s < 0.2 ? 'good' : s < 0.4 ? 'neutral' : 'warn',
            title: `${pct}% of window is silence`,
        });
    }

    // Face coverage: > 70% good, 40-70% neutral, < 40% warn. Skip if None.
    if (typeof breakdown.face_coverage_fraction === 'number') {
        const f = breakdown.face_coverage_fraction;
        const pct = Math.round(f * 100);
        chips.push({
            label: `face: ${pct}%`,
            tone: f >= 0.7 ? 'good' : f >= 0.4 ? 'neutral' : 'warn',
            title: `${pct}% of window has a tracked face`,
        });
    }

    // Speaker moves: 0 good, 1 neutral, 2+ warn.
    if (typeof breakdown.speaker_moves_in_window === 'number') {
        const m = breakdown.speaker_moves_in_window;
        chips.push({
            label: `moves: ${m}`,
            tone: m === 0 ? 'good' : m === 1 ? 'neutral' : 'warn',
            title:
                m === 0
                    ? 'Speaker stays put — clean vertical crop'
                    : `Speaker moved ${m} time(s) — crop may be jumpy`,
        });
    }

    // Info density ratio: relative to source baseline. >1.0 good, 0.5-1.0 neutral, <0.5 warn.
    if (typeof breakdown.info_density_ratio === 'number') {
        const r = breakdown.info_density_ratio;
        const display = r >= 1.0 ? `info: ${r.toFixed(1)}×` : `info: ${r.toFixed(2)}×`;
        chips.push({
            label: display,
            tone: r >= 1.0 ? 'good' : r >= 0.5 ? 'neutral' : 'warn',
            title: `Info density ${r.toFixed(2)}× the source baseline`,
        });
    }

    if (chips.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1">
            {chips.map((c, i) => (
                <span
                    key={i}
                    title={c.title}
                    className={cn(
                        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        c.tone === 'good' && 'bg-emerald-50 text-emerald-700',
                        c.tone === 'neutral' && 'bg-neutral-100 text-neutral-700',
                        c.tone === 'warn' && 'bg-amber-50 text-amber-700',
                    )}
                >
                    {c.label}
                </span>
            ))}
        </div>
    );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
    // Color the bar by its OWN value, not the composite — lets the user
    // visually catch a weak axis even on a high-composite candidate.
    const tone = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-neutral-700' : 'bg-amber-400';
    return (
        <div className="space-y-0.5">
            <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                    className={cn('h-full', tone)}
                    style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
                />
            </div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                {label}
            </p>
        </div>
    );
}

function formatTimestamp(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
