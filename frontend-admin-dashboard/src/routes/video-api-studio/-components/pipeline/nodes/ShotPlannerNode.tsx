import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Clapperboard, Loader2, Volume2, VolumeX } from 'lucide-react';
import { BaseNodeShell } from './BaseNodeShell';
import { ACTIVE_SUB_STATUS } from '../-utils/stage-vocab';
import type { PipelineNodeData } from '../-utils/build-pipeline-graph';

/**
 * ShotPlanner node (v3 only). Replaces the v2 Beats + Screenplay + Storyboard
 * chain — one LLM call emits the full shot plan with intent_role,
 * audio_policy, background_treatment, transition_in, plus plan-level
 * recurring_motifs. Wrapped state shows the audio-policy mix at a glance so
 * users can spot how many shots are intrinsic_only (Veo audio / source clip)
 * vs narrated.
 */
function ShotPlannerNodeInner({ data }: NodeProps<PipelineNodeData>) {
    const slot = data.state.shotPlanner;
    if (!slot) return null;

    if (slot.state === 'scheduled') {
        return (
            <BaseNodeShell kind="shotPlanner" state={slot.state}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clapperboard className="size-3.5 text-muted-foreground/60" />
                    Awaiting brief lock-in
                </div>
            </BaseNodeShell>
        );
    }

    if (slot.state === 'cut' || slot.state === 'reshoot') {
        return (
            <BaseNodeShell kind="shotPlanner" state={slot.state}>
                <p className="text-[11px] text-red-700">{slot.error}</p>
            </BaseNodeShell>
        );
    }

    if (slot.state === 'in_production') {
        return (
            <BaseNodeShell kind="shotPlanner" state={slot.state}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-blue-600" />
                    {ACTIVE_SUB_STATUS.shotPlanner}
                </div>
            </BaseNodeShell>
        );
    }

    if (slot.state !== 'wrapped') return null;
    const { shotCount, intrinsicCount, narratedCount, recurringMotifs } = slot.data;
    const headerMeta = shotCount > 0 ? `${shotCount} shot${shotCount === 1 ? '' : 's'}` : undefined;

    return (
        <BaseNodeShell kind="shotPlanner" state={slot.state} headerMeta={headerMeta}>
            <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px]">
                    <Volume2 className="size-3 text-green-600" />
                    <span className="font-mono tabular-nums text-foreground">{narratedCount}</span>
                    <span className="text-muted-foreground">narrated</span>
                    <span className="mx-1 text-muted-foreground/40">·</span>
                    <VolumeX className="size-3 text-amber-600" />
                    <span className="font-mono tabular-nums text-foreground">{intrinsicCount}</span>
                    <span className="text-muted-foreground">intrinsic</span>
                </div>
                {recurringMotifs.length > 0 && (
                    <p className="line-clamp-2 text-[10px] italic text-foreground/70">
                        {recurringMotifs.length} recurring motif
                        {recurringMotifs.length === 1 ? '' : 's'}:{' '}
                        {recurringMotifs[0]?.description ?? ''}
                        {recurringMotifs.length > 1 ? ', …' : ''}
                    </p>
                )}
                <p className="text-[10px] text-muted-foreground">
                    Plan locked. Click for full breakdown.
                </p>
            </div>
        </BaseNodeShell>
    );
}

export const ShotPlannerNode = memo(ShotPlannerNodeInner);
