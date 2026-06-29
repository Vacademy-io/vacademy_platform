import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Sparkle, FilmSlate } from '@phosphor-icons/react';
import type {
    DecisionAnswer,
    DecisionRequest,
    ShotPlanRow,
} from '../../../-services/video-generation';

interface ShotPlanDecisionProps {
    decision: DecisionRequest;
    isSubmitting?: boolean;
    onSubmit: (answer: DecisionAnswer) => void;
}

type Row = ShotPlanRow;

const TRANSITIONS = [
    'cut',
    'fade',
    'crossfade',
    'slide_left',
    'slide_up',
    'zoom_in',
    'whip_pan',
    'circle_iris',
    'smash_cut',
    'dip_to_black',
    'dissolve_up',
];
const BACKGROUNDS = ['brand_solid', 'brand_textured', 'brand_gradient', 'media_hero'];

const selectCls =
    'h-8 rounded-md border bg-background px-2 text-xs text-foreground outline-none focus:border-violet-500';

/**
 * Shot-plan gate — an editable table of the drafted shots. The user can tweak
 * each shot's type, duration, and brief, then approve; or let the AI keep its
 * plan. Editing any field switches "Approve" to an edit submission.
 */
export function ShotPlanDecision({ decision, isSubmitting, onSubmit }: ShotPlanDecisionProps) {
    const initial = useMemo<Row[]>(
        () =>
            (decision.payload?.shots ?? []).map((s, i) => ({
                ...s,
                shot_index: s.shot_index ?? i,
            })),
        [decision.payload?.shots]
    );
    const [rows, setRows] = useState<Row[]>(initial);
    const [dirty, setDirty] = useState(false);

    const update = (idx: number, patch: Partial<Row>) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
        setDirty(true);
    };

    const approve = () => {
        if (dirty) {
            onSubmit({ kind: 'edit', gate_type: 'shot_plan', shots: rows });
        } else {
            onSubmit({ kind: 'accept_recommended' });
        }
    };

    return (
        <div className="rounded-xl border bg-white shadow-sm dark:bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
                <span className="flex size-7 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
                    <FilmSlate className="size-4 text-violet-600" />
                </span>
                <div className="text-sm font-semibold text-foreground">
                    {rows.length}-shot plan
                </div>
            </div>

            <div className="max-h-96 divide-y overflow-y-auto">
                {rows.map((r, i) => (
                    <div key={r.shot_index} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                        <span className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                            {i + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <div className="grid gap-2 sm:grid-cols-[140px_90px_1fr]">
                                <Input
                                    value={r.shot_type ?? ''}
                                    disabled={isSubmitting}
                                    onChange={(e) => update(i, { shot_type: e.target.value })}
                                    className="h-8 text-xs"
                                    placeholder="shot type"
                                />
                                <Input
                                    type="number"
                                    value={r.duration_estimate_s ?? r.duration_s ?? ''}
                                    disabled={isSubmitting}
                                    onChange={(e) =>
                                        update(i, { duration_estimate_s: Number(e.target.value) })
                                    }
                                    className="h-8 text-xs"
                                    placeholder="secs"
                                />
                                <Input
                                    value={r.narration_brief ?? ''}
                                    disabled={isSubmitting}
                                    onChange={(e) => update(i, { narration_brief: e.target.value })}
                                    className="h-8 text-xs"
                                    placeholder="what this beat covers"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <select
                                    value={r.transition_in ?? ''}
                                    disabled={isSubmitting}
                                    onChange={(e) => update(i, { transition_in: e.target.value })}
                                    className={selectCls}
                                    aria-label="transition in"
                                >
                                    <option value="">transition…</option>
                                    {TRANSITIONS.map((t) => (
                                        <option key={t} value={t}>
                                            {t.replace(/_/g, ' ')}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={r.background_treatment ?? ''}
                                    disabled={isSubmitting}
                                    onChange={(e) =>
                                        update(i, { background_treatment: e.target.value })
                                    }
                                    className={selectCls}
                                    aria-label="background treatment"
                                >
                                    <option value="">background…</option>
                                    {BACKGROUNDS.map((b) => (
                                        <option key={b} value={b}>
                                            {b.replace(/_/g, ' ')}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => onSubmit({ kind: 'auto' })}
                    className="gap-1.5 text-muted-foreground"
                >
                    <Sparkle className="size-3.5" />
                    Let AI decide
                </Button>
                <Button
                    size="sm"
                    disabled={isSubmitting}
                    onClick={approve}
                    className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
                >
                    <Check className="size-4" />
                    {dirty ? 'Save & continue' : 'Approve plan'}
                </Button>
            </div>
        </div>
    );
}
