import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Loader2, PenLine, VolumeX } from 'lucide-react';
import { BaseNodeShell } from './BaseNodeShell';
import { ACTIVE_SUB_STATUS } from '../-utils/stage-vocab';
import type { PipelineNodeData } from '../-utils/build-pipeline-graph';

/**
 * NarrationWriter node (v3 only). Authors per-shot narration_text in one
 * coherent LLM call after ShotPlanner locks the shot list. Intrinsic_only
 * shots get an empty string (and skip per-shot TTS); everyone else gets a
 * budgeted line at ~150 wpm × shot duration.
 */
function NarrationWriterNodeInner({ data }: NodeProps<PipelineNodeData>) {
    const slot = data.state.narrationWriter;
    if (!slot) return null;

    if (slot.state === 'scheduled') {
        return (
            <BaseNodeShell kind="narrationWriter" state={slot.state}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <PenLine className="size-3.5 text-muted-foreground/60" />
                    Writers&apos; room is waiting for the plan
                </div>
            </BaseNodeShell>
        );
    }

    if (slot.state === 'cut' || slot.state === 'reshoot') {
        return (
            <BaseNodeShell kind="narrationWriter" state={slot.state}>
                <p className="text-[11px] text-red-700">{slot.error}</p>
            </BaseNodeShell>
        );
    }

    if (slot.state === 'in_production') {
        return (
            <BaseNodeShell kind="narrationWriter" state={slot.state}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-blue-600" />
                    {ACTIVE_SUB_STATUS.narrationWriter}
                </div>
            </BaseNodeShell>
        );
    }

    if (slot.state !== 'wrapped') return null;
    const { totalWords, perShotWordCounts, skippedIntrinsicCount } = slot.data;
    const writtenShots = perShotWordCounts.filter((n) => n > 0).length;
    const avg = writtenShots > 0 ? Math.round(totalWords / writtenShots) : 0;
    const headerMeta = totalWords > 0 ? `${totalWords} words` : undefined;

    return (
        <BaseNodeShell kind="narrationWriter" state={slot.state} headerMeta={headerMeta}>
            <div className="space-y-1">
                <p className="text-[11px] text-foreground">
                    <span className="font-mono tabular-nums">{writtenShots}</span>{' '}
                    <span className="text-muted-foreground">
                        shot{writtenShots === 1 ? '' : 's'} voiced
                    </span>
                    {avg > 0 && <span className="text-muted-foreground"> · avg {avg} w</span>}
                </p>
                {skippedIntrinsicCount > 0 && (
                    <p className="flex items-center gap-1 text-[10px] text-amber-700">
                        <VolumeX className="size-3" />
                        {skippedIntrinsicCount} intrinsic shot
                        {skippedIntrinsicCount === 1 ? '' : 's'} silenced (Veo/source audio)
                    </p>
                )}
                <p className="text-[10px] text-muted-foreground">
                    Per-shot TTS picks these up downstream.
                </p>
            </div>
        </BaseNodeShell>
    );
}

export const NarrationWriterNode = memo(NarrationWriterNodeInner);
