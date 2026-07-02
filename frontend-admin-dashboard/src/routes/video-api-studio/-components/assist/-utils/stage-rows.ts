import type { PipelineState, NodeState } from '../../pipeline/-utils/derive-pipeline-state';
import { NODE_LABELS, type PipelineNodeId } from '../../pipeline/-utils/stage-vocab';

export interface StageRow {
    id: string;
    label: string;
    state: NodeState;
    /** Optional inline counter, e.g. "3/8" for Filming. */
    detail?: string;
}

/**
 * Flatten a PipelineState into the same ordered stage list the diagram's
 * "Production schedule" shows (mirrors PipelinePanel.stagesList), so the chat's
 * live status stays consistent with the diagram. v2/v3-aware; hides optional
 * stages that aren't present on this run.
 */
export function buildStageRows(state: PipelineState): StageRow[] {
    const isV3 = state.pipelineVersion === 'v3';
    const order: PipelineNodeId[] = [
        ...(state.research ? (['research'] as PipelineNodeId[]) : []),
        ...(isV3
            ? ([
                  ...(state.shotPlanner ? ['shotPlanner'] : []),
                  ...(state.narrationWriter ? ['narrationWriter'] : []),
              ] as PipelineNodeId[])
            : ([
                  ...(state.beats ? ['beats'] : []),
                  'screenplay',
                  'narration',
                  'storyboard',
              ] as PipelineNodeId[])),
        'filming',
        ...(state.talent ? (['talent'] as PipelineNodeId[]) : []),
        ...(state.score ? (['score'] as PipelineNodeId[]) : []),
        'finalCut',
    ];

    return order.map((id) => {
        const slot = (state as unknown as Record<string, { state?: NodeState } | undefined>)[id];
        const slotState: NodeState = slot?.state ?? 'scheduled';
        let detail: string | undefined;
        if (id === 'filming' && state.scenes.length > 0) {
            const wrapped = state.scenes.filter((s) => s.state === 'wrapped').length;
            const total = state.scenes.length;
            if (!(state.filming.state === 'wrapped' && wrapped === total)) {
                detail = `${wrapped}/${total}`;
            }
        }
        return { id, label: NODE_LABELS[id], state: slotState, detail };
    });
}
