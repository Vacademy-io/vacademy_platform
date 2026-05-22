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
 * Edit mode (B4 — 2026-05-22): when `editable=true`, low-importance words
 * that aren't already in an auto-cut become clickable. Clicking adds the
 * word's index to `userCutIndices`; clicking again removes it. Words with
 * importance>=2 stay protected (disabled cursor + tooltip). User-toggled
 * cuts render with a distinct dashed strikethrough so the auto vs user
 * distinction is visually obvious before render.
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
    /** B4 edit-cuts mode. When true, importance<=1 non-auto-cut words become
     *  click-to-toggle. Default false preserves the read-only view. */
    editable?: boolean;
    /** Set of word indices the user has toggled to cut. */
    userCutIndices?: ReadonlySet<number>;
    /** Toggle callback. Only fired for importance<=1 non-auto words. */
    onToggleWordCut?: (wordIndex: number) => void;
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
    editable = false,
    userCutIndices,
    onToggleWordCut,
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

    // For per-word styling — is this word's center inside any AUTO cut?
    const isWordAutoCut = useMemo(() => {
        const cutsLocal = cuts;
        return (w: WordImportance) => {
            const mid = (w.t_start + w.t_end) / 2;
            return cutsLocal.some((c) => mid >= c.t_start && mid <= c.t_end);
        };
    }, [cuts]);

    // User-cut overlays for the top track (computed from user word indices).
    const userCutBounds = useMemo(() => {
        if (!userCutIndices || userCutIndices.size === 0) return [];
        return Array.from(userCutIndices).map((idx) => {
            const w = words[idx];
            if (!w) return null;
            const leftPct = Math.max(0, ((w.t_start - sourceStartS) / sourceDuration) * 100);
            const widthPct = Math.max(
                0.4,
                ((w.t_end - w.t_start) / sourceDuration) * 100
            );
            return { leftPct, widthPct, t_start: w.t_start, t_end: w.t_end, word: w.word };
        }).filter((x): x is NonNullable<typeof x> => x !== null);
    }, [userCutIndices, words, sourceStartS, sourceDuration]);

    // Stats line: how much we cut + kept.
    const autoCutSeconds = cuts.reduce((acc, c) => acc + Math.max(0, c.t_end - c.t_start), 0);
    const userCutSeconds = useMemo(() => {
        if (!userCutIndices || userCutIndices.size === 0) return 0;
        let total = 0;
        userCutIndices.forEach((idx) => {
            const w = words[idx];
            if (w) total += Math.max(0, w.t_end - w.t_start);
        });
        return total;
    }, [userCutIndices, words]);
    const cutSeconds = autoCutSeconds + userCutSeconds;
    const keptSeconds = Math.max(0, sourceDuration - cutSeconds);

    return (
        <div className="space-y-3">
            {/* Track — 30k-ft cut view */}
            <div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                    {cutBounds.map((c, i) => (
                        <div
                            key={`auto-${i}`}
                            className={cn(
                                'absolute top-0 h-full',
                                c.kind === 'filler' && 'bg-amber-400',
                                c.kind === 'silence' && 'bg-neutral-400',
                                c.kind === 'word' && 'bg-red-400',
                                // `kind === 'user'` shows up when this
                                // component is fed an EFFECTIVE cut plan
                                // (auto + user merged), e.g. on the detail
                                // page reading reel.config.enriched_snapshot
                                // .cut_plan. The PreviewTray's pre-render
                                // view passes only auto cuts here and
                                // overlays user cuts separately below.
                                c.kind === 'user' && 'bg-orange-500',
                            )}
                            style={{
                                left: `${c.leftPct}%`,
                                width: `${c.widthPct}%`,
                            }}
                            title={`${c.kind} cut: ${c.t_start.toFixed(2)}–${c.t_end.toFixed(2)}s`}
                        />
                    ))}
                    {userCutBounds.map((c, i) => (
                        <div
                            key={`user-${i}`}
                            className="absolute top-0 h-full bg-orange-500"
                            style={{
                                left: `${c.leftPct}%`,
                                width: `${c.widthPct}%`,
                            }}
                            title={`user cut "${c.word}": ${c.t_start.toFixed(2)}–${c.t_end.toFixed(2)}s`}
                        />
                    ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                    <span>{keptSeconds.toFixed(1)}s kept</span>
                    <span>
                        {cutSeconds.toFixed(1)}s cut · {cuts.length + (userCutIndices?.size ?? 0)} cut
                        {cuts.length + (userCutIndices?.size ?? 0) === 1 ? '' : 's'}
                        {userCutIndices && userCutIndices.size > 0 && (
                            <span className="ml-1 text-orange-600">
                                ({userCutIndices.size} yours)
                            </span>
                        )}
                    </span>
                </div>
            </div>

            {/* Per-word transcript with cut styling */}
            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm leading-relaxed">
                {words.length === 0 ? (
                    <p className="text-xs text-neutral-500">(no transcribed speech in this window)</p>
                ) : (
                    <p className="space-x-1">
                        {words.map((w, i) => {
                            const autoCut = isWordAutoCut(w);
                            const userCut = userCutIndices?.has(i) ?? false;
                            const cut = autoCut || userCut;
                            const protectedWord = w.importance >= 2;
                            const toggleable =
                                editable && !autoCut && !protectedWord && !!onToggleWordCut;
                            const keywordTone = w.keyword_type
                                ? KEYWORD_COLORS[w.keyword_type]
                                : 'text-neutral-900';
                            const baseClasses = cn(
                                'inline rounded px-0.5',
                                cut
                                    ? userCut && !autoCut
                                        ? 'text-orange-700 line-through decoration-orange-500 decoration-2 decoration-dashed'
                                        : 'text-neutral-400 line-through decoration-red-400 decoration-2'
                                    : keywordTone,
                                editable && toggleable && 'cursor-pointer hover:bg-orange-50',
                                editable && protectedWord && 'cursor-not-allowed',
                            );
                            const title = [
                                `importance ${w.importance}`,
                                w.keyword_type && w.keyword_type,
                                w.emoji && `emoji ${w.emoji}`,
                                autoCut && 'auto-cut',
                                userCut && 'user-cut (click to undo)',
                                editable && protectedWord && 'protected (importance ≥ 2)',
                                editable && toggleable && !cut && 'click to cut',
                            ]
                                .filter(Boolean)
                                .join(' · ');
                            if (toggleable) {
                                return (
                                    <button
                                        key={`${w.word}-${i}`}
                                        type="button"
                                        onClick={() => onToggleWordCut?.(i)}
                                        className={baseClasses}
                                        title={title}
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
                                    </button>
                                );
                            }
                            return (
                                <span
                                    key={`${w.word}-${i}`}
                                    className={baseClasses}
                                    title={title}
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
