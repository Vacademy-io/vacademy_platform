import { memo } from 'react';
import { NodeProps } from 'reactflow';

/**
 * Visual-only node that wraps the Talent + Score branch row with a
 * dashed container so users can read the fan-out from Storyboard /
 * fan-in to Final Cut as a deliberate "B-roll lanes" group rather
 * than two free-floating cards.
 *
 * Sized + positioned by `PipelineFlow` after the talent / score nodes
 * land — see the manual-positioning block. Renders behind the actual
 * branch nodes via negative `zIndex` on the wrapper, and disables
 * pointer events so click-through reaches the wrapped nodes.
 */
export interface BrollLaneNodeData {
    width: number;
    height: number;
}

function BrollLaneNodeInner({ data }: NodeProps<BrollLaneNodeData>) {
    return (
        <div
            style={{ width: data.width, height: data.height }}
            className="pointer-events-none relative rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/40"
        >
            <span className="absolute -top-2.5 left-3 bg-white px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                B-roll lanes
            </span>
        </div>
    );
}

export const BrollLaneNode = memo(BrollLaneNodeInner);
