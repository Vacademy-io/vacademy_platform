import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Sparkle, Image as ImageIcon, PlayCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type {
    DecisionAnswer,
    DecisionRequest,
    VisualCastingCandidate,
} from '../../../-services/video-generation';

interface VisualCastingDecisionProps {
    decision: DecisionRequest;
    isSubmitting?: boolean;
    onSubmit: (answer: DecisionAnswer) => void;
}

/**
 * Visual-casting gate — a grid of candidate stock images / clips for one shot.
 * The user picks one, lets the AI pick this shot, or lets the AI pick this and
 * every remaining shot ("auto_all", the escape hatch for granular pausing).
 *
 * (The backend fires this gate in a later phase; the card is built so it's
 * plug-and-play once per-shot casting candidates are emitted.)
 */
export function VisualCastingDecision({ decision, isSubmitting, onSubmit }: VisualCastingDecisionProps) {
    const candidates: VisualCastingCandidate[] = decision.payload?.candidates ?? [];
    const shotIndex = decision.shot_index ?? 0;
    const [selected, setSelected] = useState<string | null>(
        decision.payload?.recommended_candidate_id ?? null
    );

    const useSelected = () => {
        if (!selected) {
            onSubmit({ kind: 'auto' });
            return;
        }
        onSubmit({
            kind: 'edit',
            gate_type: 'visual_casting',
            selections: [{ shot_index: shotIndex, candidate_id: selected }],
        });
    };

    return (
        <div className="rounded-xl border bg-white shadow-sm dark:bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-foreground">
                <span className="flex size-7 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
                    <ImageIcon className="size-4 text-violet-600" />
                </span>
                Pick a visual for shot {shotIndex + 1}
            </div>

            {candidates.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No candidates available — let the AI choose.
                </div>
            ) : (
                <div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3">
                    {candidates.map((c) => {
                        const isSel = selected === c.candidate_id;
                        return (
                            <button
                                key={c.candidate_id}
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => setSelected(c.candidate_id)}
                                className={cn(
                                    'group relative aspect-video overflow-hidden rounded-lg border-2 bg-muted transition-colors',
                                    isSel ? 'border-violet-500 ring-2 ring-violet-500/30' : 'border-transparent hover:border-border'
                                )}
                            >
                                <img
                                    src={c.thumb || c.url}
                                    alt={c.alt ?? ''}
                                    className="size-full object-cover"
                                    loading="lazy"
                                />
                                {c.kind === 'video' && (
                                    <PlayCircle className="absolute bottom-1.5 right-1.5 size-5 text-white drop-shadow" />
                                )}
                                {c.is_recommended && (
                                    <span className="absolute left-1.5 top-1.5 rounded bg-violet-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                                        Suggested
                                    </span>
                                )}
                                {isSel && (
                                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-violet-600 text-white">
                                        <Check className="size-3" />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => onSubmit({ kind: 'auto' })}
                        className="gap-1.5 text-muted-foreground"
                    >
                        <Sparkle className="size-3.5" />
                        Let AI pick
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => onSubmit({ kind: 'auto_all' })}
                        className="gap-1.5 text-muted-foreground"
                    >
                        Let AI pick the rest
                    </Button>
                </div>
                <Button
                    size="sm"
                    disabled={isSubmitting || !selected}
                    onClick={useSelected}
                    className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
                >
                    <Check className="size-4" />
                    Use this
                </Button>
            </div>
        </div>
    );
}
