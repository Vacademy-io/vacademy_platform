/**
 * Visualizes the 7-stage render pipeline. Each stage shows one of:
 *   - completed (green check) — stage has an entry in `stages[]` with progress=100
 *   - active (spinning loader) — current_stage matches AND status='IN_PROGRESS'
 *   - failed (red alert) — status='FAILED' AND this is the first stage that
 *     never completed
 *   - pending (grey circle) — none of the above (queued, hasn't run yet)
 *
 * The canonical stage order is hardcoded on the FE so we render rows even
 * before the backend has reported anything yet (PENDING state, no
 * `stages[]` data yet). It matches `STAGE_PIPELINE` in the backend
 * orchestrator — if a stage gets added there, this list must be updated.
 */
import { AlertCircle, Check, Circle } from 'lucide-react';
import { VimotionLoader } from '../../brand/VimotionLoader';
import { cn } from '@/lib/utils';
import type { ReelResponse } from '../services/reels-api';

const STAGE_ORDER: Array<{ key: string; label: string; hint: string }> = [
    { key: 'AUDIO_EDIT', label: 'Audio edit', hint: 'Cutting + atempo on the speaker audio' },
    { key: 'SOURCE_CLIP', label: 'Source clip', hint: 'Aspect crop + frame-accurate cuts' },
    { key: 'STYLE_GUIDE', label: 'Style guide', hint: 'Palette + typography' },
    { key: 'DIRECTOR', label: 'Director', hint: 'Shot plan + overlay placement' },
    { key: 'HTML', label: 'HTML', hint: 'Per-shot HTML generation' },
    { key: 'ASSEMBLE', label: 'Assemble', hint: 'Final {meta, entries} payload' },
    { key: 'RENDER', label: 'Render', hint: 'Frame capture + MP4 encoding' },
];

interface StageProgressListProps {
    reel: ReelResponse;
}

type StageState = 'completed' | 'active' | 'failed' | 'pending';

export function StageProgressList({ reel }: StageProgressListProps) {
    const completedSet = new Set(
        (reel.stages ?? []).filter((s) => s.progress >= 100).map((s) => s.stage)
    );

    // Identify the failed stage if any: status=FAILED and current_stage='FAILED'
    // means a stage exception was caught. The failed stage is the first
    // STAGE_ORDER entry not in completedSet.
    const isFailed = reel.status === 'FAILED';
    let failedStageKey: string | null = null;
    if (isFailed) {
        failedStageKey =
            STAGE_ORDER.find((s) => !completedSet.has(s.key))?.key ?? null;
    }

    return (
        <ul className="space-y-2">
            {STAGE_ORDER.map((stage) => {
                const state = computeStageState(stage.key, reel, completedSet, failedStageKey);
                return (
                    <StageRow
                        key={stage.key}
                        label={stage.label}
                        hint={stage.hint}
                        state={state}
                    />
                );
            })}
        </ul>
    );
}

function computeStageState(
    stageKey: string,
    reel: ReelResponse,
    completedSet: Set<string>,
    failedStageKey: string | null
): StageState {
    if (completedSet.has(stageKey)) return 'completed';
    if (stageKey === failedStageKey) return 'failed';
    if (
        reel.status === 'IN_PROGRESS' &&
        reel.current_stage === stageKey
    )
        return 'active';
    return 'pending';
}

function StageRow({
    label,
    hint,
    state,
}: {
    label: string;
    hint: string;
    state: StageState;
}) {
    return (
        <li className="flex items-start gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-neutral-200">
            <StageIcon state={state} />
            <div className="min-w-0 flex-1">
                <p
                    className={cn(
                        'text-sm font-medium',
                        state === 'completed' && 'text-neutral-900',
                        state === 'active' && 'text-neutral-900',
                        state === 'failed' && 'text-red-700',
                        state === 'pending' && 'text-neutral-400'
                    )}
                >
                    {label}
                </p>
                <p
                    className={cn(
                        'text-xs',
                        state === 'failed' ? 'text-red-600' : 'text-neutral-500'
                    )}
                >
                    {hint}
                </p>
            </div>
        </li>
    );
}

function StageIcon({ state }: { state: StageState }) {
    if (state === 'completed') {
        return (
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="size-3.5" />
            </span>
        );
    }
    if (state === 'active') {
        return (
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <VimotionLoader size={14} className="text-blue-700" />
            </span>
        );
    }
    if (state === 'failed') {
        return (
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                <AlertCircle className="size-3.5" />
            </span>
        );
    }
    return (
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-neutral-300">
            <Circle className="size-3.5" />
        </span>
    );
}
