import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Camera, Loader2 } from 'lucide-react';
import { Handle, Position } from 'reactflow';
import type { PipelineNodeData } from '../-utils/build-pipeline-graph';
import type { NodeState, SceneSlot } from '../-utils/derive-pipeline-state';
import { NODE_SIZES } from '../-utils/build-pipeline-graph';

/**
 * One scene in the production. Smaller and more numerous than the linear
 * production-stage nodes — there's one of these per shot in the Director's
 * plan, ranked vertically off Storyboard.
 *
 * Visual hierarchy is intentionally lighter than `BaseNodeShell` (single
 * border + state-tinted left edge instead of a full ring) so a column of
 * 8–30 scenes doesn't overwhelm the diagram.
 */

const STATE_VISUAL: Record<
    NodeState,
    { edge: string; bg: string; iconBg: string; chipColor: string }
> = {
    scheduled: {
        edge: 'border-l-gray-300',
        bg: 'bg-white',
        iconBg: 'bg-gray-100 text-gray-500',
        chipColor: 'bg-gray-100 text-gray-600',
    },
    in_production: {
        edge: 'border-l-blue-500',
        bg: 'bg-blue-50/40',
        iconBg: 'bg-blue-100 text-blue-700',
        chipColor: 'bg-blue-100 text-blue-700',
    },
    wrapped: {
        edge: 'border-l-green-500',
        bg: 'bg-white',
        iconBg: 'bg-green-100 text-green-700',
        chipColor: 'bg-green-100 text-green-700',
    },
    reshoot: {
        edge: 'border-l-amber-500',
        bg: 'bg-amber-50/40',
        iconBg: 'bg-amber-100 text-amber-700',
        chipColor: 'bg-amber-100 text-amber-700',
    },
    cut: {
        edge: 'border-l-red-500',
        bg: 'bg-red-50/40',
        iconBg: 'bg-red-100 text-red-700',
        chipColor: 'bg-red-100 text-red-700',
    },
};

function SceneNodeInner({ data }: NodeProps<PipelineNodeData>) {
    const idx = data.sceneIndex ?? -1;
    const scene: SceneSlot | undefined = data.state.scenes[idx];
    if (!scene) return null;
    const visual = STATE_VISUAL[scene.state];
    const sceneNumber = String(scene.index + 1).padStart(2, '0');
    const hasThumb = !!(scene.imageUrl || scene.videoUrl);

    return (
        <div
            aria-label={`Scene ${sceneNumber} — click for details`}
            // Pin both dimensions to NODE_SIZES so the rendered DOM never
            // grows past what dagre reserved for this node. Without `height`
            // pinned, narration text or a tall thumbnail would push the node
            // beyond 240px and adjacent scenes in the same rank would visibly
            // overlap each other.
            style={{ width: NODE_SIZES.scene.width, height: NODE_SIZES.scene.height }}
            className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-l-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${visual.edge} ${visual.bg}`}
        >
            <Handle
                type="target"
                position={Position.Left}
                className="!size-1 !border-0 !bg-transparent"
            />
            <Handle
                type="target"
                position={Position.Top}
                className="!size-1 !border-0 !bg-transparent"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!size-1 !border-0 !bg-transparent"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                className="!size-1 !border-0 !bg-transparent"
            />

            {/* Header — scene number + state icon + shot type chip */}
            <div className="flex shrink-0 items-center gap-1.5 px-2 py-1.5">
                <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold tabular-nums ${visual.iconBg}`}
                >
                    {scene.state === 'in_production' ? (
                        <Loader2 className="size-3 animate-spin" />
                    ) : (
                        sceneNumber
                    )}
                </span>
                <span
                    className={`shrink-0 rounded px-1 text-[9px] font-medium uppercase tracking-wider ${visual.chipColor}`}
                >
                    {scene.shotType.replace(/_/g, ' ')}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
                    {scene.durationS.toFixed(1)}s
                </span>
            </div>

            {/* Thumbnail (when timeline.json is loaded) — falls back to a
                placeholder camera icon while parsing or when no media is in
                the scene HTML (pure-text shots). */}
            <div className="relative aspect-video w-full bg-gray-100">
                {scene.videoUrl ? (
                    <video
                        src={scene.videoUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="size-full object-cover"
                    />
                ) : scene.imageUrl ? (
                    <img
                        src={scene.imageUrl}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                    />
                ) : (
                    <div className="flex size-full items-center justify-center">
                        <Camera className="size-5 text-gray-300" />
                    </div>
                )}
                {!hasThumb && scene.state === 'wrapped' && (
                    <div className="absolute bottom-1 right-1 rounded bg-black/40 px-1 py-0.5 text-[8px] text-white">
                        text scene
                    </div>
                )}
            </div>

            {/* Narration excerpt */}
            {scene.narrationExcerpt && (
                <p className="line-clamp-2 break-words border-t border-black/5 px-2 py-1 text-[10px] italic leading-snug text-foreground/70">
                    &ldquo;{scene.narrationExcerpt}&rdquo;
                </p>
            )}
        </div>
    );
}

export const SceneNode = memo(SceneNodeInner);
