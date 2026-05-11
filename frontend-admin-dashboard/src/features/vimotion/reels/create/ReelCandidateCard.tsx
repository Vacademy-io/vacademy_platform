/**
 * Single scan-candidate card. Shows enough signal for the user to decide
 * whether this clip is worth previewing:
 *
 *   - Thumbnail (from backend's async `thumbnail_strip_url`; placeholder
 *     if it hasn't landed yet — backend generates these in the background
 *     after /scan returns)
 *   - Timestamp range in source (e.g. "12:40 → 13:35")
 *   - 4-axis score bars (Hook / Pacing / Info / Loop) — research §12.4
 *     says transparency in scoring beats Opus's single opaque number
 *   - Composite score as a big number
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

                {/* 4-axis bars — gives the user a feel for *why* this clip scored
                    the way it did without needing to expand a tooltip. */}
                <div className="grid grid-cols-4 gap-1.5">
                    <ScoreBar label="Hook" value={candidate.score.hook} />
                    <ScoreBar label="Pacing" value={candidate.score.pacing} />
                    <ScoreBar label="Info" value={candidate.score.info} />
                    <ScoreBar label="Loop" value={candidate.score.loop} />
                </div>

                <p className="line-clamp-3 text-xs leading-snug text-neutral-600">
                    {candidate.transcript_snippet || '(silent window)'}
                </p>
            </div>
        </button>
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
