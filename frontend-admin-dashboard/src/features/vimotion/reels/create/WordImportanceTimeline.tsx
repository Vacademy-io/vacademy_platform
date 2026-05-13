/**
 * Visualizes the LLM-produced cut plan against the candidate's word stream.
 *
 * Two layers:
 *
 *   1. A thin horizontal track showing kept vs cut spans across the source
 *      window — gives the user a 30,000-ft view of how much got removed.
 *
 *   2. The transcribed words rendered inline with per-word styling:
 *        - importance ≥ 2 (kept content) → normal color
 *        - importance ≤ 1 AND inside a cut span → strikethrough + faded
 *        - importance 3 with a keyword_type → colored by type
 *      This is the "see exactly what's coming out before you pay for render"
 *      view the FE plan §13.6 calls out.
 *
 * Timestamps in `word_importance` and `cut_plan` are SOURCE timecodes;
 * we treat them as opaque and just need t_start/t_end to position the
 * track segments and detect overlap.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { CutSpan, WordImportance } from '../services/reels-api';

interface WordImportanceTimelineProps {
    /** Source window — used as the 0..100% domain for the track. */
    sourceStartS: number;
    sourceEndS: number;
    words: WordImportance[];
    cuts: CutSpan[];
}

const KEYWORD_COLORS: Record<NonNullable<WordImportance['keyword_type']>, string> = {
    important: 'text-amber-600',
    definition: 'text-emerald-600',
    warning: 'text-red-600',
};

export function WordImportanceTimeline({
    sourceStartS,
    sourceEndS,
    words,
    cuts,
}: WordImportanceTimelineProps) {
    const sourceDuration = Math.max(0.001, sourceEndS - sourceStartS);

    // Precompute: for each cut span, the % bounds relative to the window.
    const cutBounds = useMemo(
        () =>
            cuts.map((c) => ({
                ...c,
                leftPct: Math.max(0, ((c.t_start - sourceStartS) / sourceDuration) * 100),
                widthPct: Math.max(
                    0,
                    Math.min(100, ((c.t_end - c.t_start) / sourceDuration) * 100)
                ),
            })),
        [cuts, sourceStartS, sourceDuration]
    );

    // For per-word styling — is this word's center inside any cut?
    const isWordCut = useMemo(() => {
        const cutsLocal = cuts;
        return (w: WordImportance) => {
            const mid = (w.t_start + w.t_end) / 2;
            return cutsLocal.some((c) => mid >= c.t_start && mid <= c.t_end);
        };
    }, [cuts]);

    // Stats line: how much we cut + kept.
    const cutSeconds = cuts.reduce((acc, c) => acc + Math.max(0, c.t_end - c.t_start), 0);
    const keptSeconds = Math.max(0, sourceDuration - cutSeconds);

    return (
        <div className="space-y-3">
            {/* Track — 30k-ft cut view */}
            <div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                    {cutBounds.map((c, i) => (
                        <div
                            key={i}
                            className={cn(
                                'absolute top-0 h-full',
                                c.kind === 'filler' && 'bg-amber-400',
                                c.kind === 'silence' && 'bg-neutral-400',
                                c.kind === 'word' && 'bg-red-400',
                            )}
                            style={{
                                left: `${c.leftPct}%`,
                                width: `${c.widthPct}%`,
                            }}
                            title={`${c.kind} cut: ${c.t_start.toFixed(2)}–${c.t_end.toFixed(2)}s`}
                        />
                    ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                    <span>{keptSeconds.toFixed(1)}s kept</span>
                    <span>{cutSeconds.toFixed(1)}s cut · {cuts.length} cut{cuts.length === 1 ? '' : 's'}</span>
                </div>
            </div>

            {/* Per-word transcript with cut styling */}
            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm leading-relaxed">
                {words.length === 0 ? (
                    <p className="text-xs text-neutral-500">(no transcribed speech in this window)</p>
                ) : (
                    <p className="space-x-1">
                        {words.map((w, i) => {
                            const cut = isWordCut(w);
                            const keywordTone = w.keyword_type
                                ? KEYWORD_COLORS[w.keyword_type]
                                : 'text-neutral-900';
                            return (
                                <span
                                    key={`${w.word}-${i}`}
                                    className={cn(
                                        'inline',
                                        cut
                                            ? 'text-neutral-400 line-through decoration-red-400 decoration-2'
                                            : keywordTone
                                    )}
                                    title={`importance ${w.importance}${w.keyword_type ? ` · ${w.keyword_type}` : ''}${w.emoji ? ` · emoji ${w.emoji}` : ''}${cut ? ' · cut' : ''}`}
                                >
                                    {w.word}
                                    {w.emoji && !cut && (
                                        <span
                                            className="ml-0.5 inline-block align-baseline"
                                            aria-hidden="true"
                                        >
                                            {w.emoji}
                                        </span>
                                    )}
                                </span>
                            );
                        })}
                    </p>
                )}
            </div>
        </div>
    );
}
