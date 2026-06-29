import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Sparkle, Image as ImageIcon, PlayCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type {
    DecisionAnswer,
    DecisionRequest,
    VisualCastingCandidate,
    VisualCastingGroup,
} from '../../../-services/video-generation';

interface VisualCastingDecisionProps {
    decision: DecisionRequest;
    isSubmitting?: boolean;
    onSubmit: (answer: DecisionAnswer) => void;
}

/**
 * Visual-casting gate — one candidate grid per media query in the video
 * ("review your visuals"). The user picks a candidate per query, leaves any to
 * the AI, or lets the AI pick everything ("auto_all"). Selections are keyed by
 * the query string (the backend forcing key).
 *
 * Accepts the batched `payload.groups` form; falls back to the single-shot
 * `payload.candidates` form for forward/back-compat.
 */
export function VisualCastingDecision({ decision, isSubmitting, onSubmit }: VisualCastingDecisionProps) {
    const groups: VisualCastingGroup[] = useMemo(() => {
        if (decision.payload?.groups?.length) return decision.payload.groups;
        // Single-shot fallback: wrap the legacy candidates array as one group.
        if (decision.payload?.candidates?.length) {
            return [
                {
                    query: decision.payload.query ?? '',
                    kind: 'image',
                    shot_index: decision.shot_index ?? undefined,
                    candidates: decision.payload.candidates,
                    recommended_candidate_id: decision.payload.recommended_candidate_id,
                },
            ];
        }
        return [];
    }, [decision]);

    // Per-query selection: candidate_id (or null = let AI decide).
    const [picks, setPicks] = useState<Record<string, string | null>>(() => {
        const init: Record<string, string | null> = {};
        for (const g of groups) init[g.query] = g.recommended_candidate_id ?? null;
        return init;
    });

    const apply = () => {
        const selections = groups.map((g) => {
            const cid = picks[g.query] ?? null;
            const url = cid ? g.candidates.find((c) => c.candidate_id === cid)?.url : undefined;
            return { query: g.query, candidate_id: cid, url, shot_index: g.shot_index };
        });
        onSubmit({ kind: 'edit', gate_type: 'visual_casting', selections });
    };

    if (groups.length === 0) {
        return (
            <div className="rounded-xl border bg-white p-6 text-center text-sm text-muted-foreground shadow-sm dark:bg-card">
                No visual candidates to review.
                <div className="mt-3">
                    <Button size="sm" disabled={isSubmitting} onClick={() => onSubmit({ kind: 'auto' })}>
                        Continue
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border bg-white shadow-sm dark:bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-foreground">
                <span className="flex size-7 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
                    <ImageIcon className="size-4 text-violet-600" />
                </span>
                Pick visuals ({groups.length} {groups.length === 1 ? 'shot' : 'shots'})
            </div>

            <div className="max-h-96 space-y-4 overflow-y-auto p-3">
                {groups.map((g, gi) => (
                    <div key={`${g.query}-${gi}`} className="space-y-1.5">
                        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                            <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                                {(g.shot_index ?? gi) + 1}
                            </span>
                            <span className="truncate">{g.query || 'visual'}</span>
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => setPicks((p) => ({ ...p, [g.query]: null }))}
                                className={cn(
                                    'ml-auto rounded px-1.5 py-0.5 text-xs',
                                    picks[g.query] == null
                                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                Let AI pick
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {g.candidates.map((c: VisualCastingCandidate) => {
                                const isSel = picks[g.query] === c.candidate_id;
                                return (
                                    <button
                                        key={c.candidate_id}
                                        type="button"
                                        disabled={isSubmitting}
                                        onClick={() =>
                                            setPicks((p) => ({ ...p, [g.query]: c.candidate_id }))
                                        }
                                        className={cn(
                                            'group relative aspect-video overflow-hidden rounded-lg border-2 bg-muted transition-colors',
                                            isSel
                                                ? 'border-violet-500 ring-2 ring-violet-500/30'
                                                : 'border-transparent hover:border-border'
                                        )}
                                    >
                                        <img
                                            src={c.thumb || c.url}
                                            alt={c.alt ?? ''}
                                            className="size-full object-cover"
                                            loading="lazy"
                                        />
                                        {c.kind === 'video' && (
                                            <PlayCircle className="absolute bottom-1 right-1 size-4 text-white drop-shadow" />
                                        )}
                                        {isSel && (
                                            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-violet-600 text-white">
                                                <Check className="size-2.5" />
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => onSubmit({ kind: 'auto_all' })}
                    className="gap-1.5 text-muted-foreground"
                >
                    <Sparkle className="size-3.5" />
                    Let AI pick all
                </Button>
                <Button
                    size="sm"
                    disabled={isSubmitting}
                    onClick={apply}
                    className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
                >
                    <Check className="size-4" />
                    Use these
                </Button>
            </div>
        </div>
    );
}
