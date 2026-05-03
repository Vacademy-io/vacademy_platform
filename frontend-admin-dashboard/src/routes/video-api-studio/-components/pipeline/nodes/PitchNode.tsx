import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Paperclip } from 'lucide-react';
import { BaseNodeShell } from './BaseNodeShell';
import type { PipelineNodeData } from '../-utils/build-pipeline-graph';

function PitchNodeInner({ data }: NodeProps<PipelineNodeData>) {
    const slot = data.state.pitch;
    const prompt = data.state.prompt || '';
    const refCount = slot.state === 'wrapped' ? slot.data.referenceCount : 0;

    return (
        <BaseNodeShell
            kind="pitch"
            state={slot.state}
            headerMeta={refCount > 0 ? `${refCount} refs` : undefined}
        >
            <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    The brief
                </div>
                {/* break-words guards against long unbroken URLs / fashion brand
                    names from forcing the node wider than NODE_SIZES allows. */}
                <p className="line-clamp-3 break-words text-xs leading-relaxed text-foreground">
                    {prompt}
                </p>
                {refCount > 0 && (
                    <div className="flex items-center gap-1 pt-1 text-[11px] text-muted-foreground">
                        <Paperclip className="size-3" />
                        {refCount} reference{refCount === 1 ? '' : 's'} attached
                    </div>
                )}
            </div>
        </BaseNodeShell>
    );
}

export const PitchNode = memo(PitchNodeInner);
