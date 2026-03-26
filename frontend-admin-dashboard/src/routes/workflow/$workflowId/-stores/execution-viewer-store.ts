import { create } from 'zustand';
import { WorkflowExecutionLogDTO } from '@/types/workflow/workflow-types';

interface ExecutionViewerState {
    selectedExecutionId: string | null;
    executionLogs: WorkflowExecutionLogDTO[];
    selectedNodeId: string | null;
    nodeStatusMap: Record<string, WorkflowExecutionLogDTO>;

    setExecution: (id: string, logs: WorkflowExecutionLogDTO[]) => void;
    selectNode: (nodeId: string | null) => void;
    clear: () => void;
}

export const useExecutionViewerStore = create<ExecutionViewerState>((set) => ({
    selectedExecutionId: null,
    executionLogs: [],
    selectedNodeId: null,
    nodeStatusMap: {},

    setExecution: (id, logs) => {
        const nodeStatusMap: Record<string, WorkflowExecutionLogDTO> = {};
        for (const log of logs) {
            if (log.node_template_id) {
                nodeStatusMap[log.node_template_id] = log;
            }
        }
        set({ selectedExecutionId: id, executionLogs: logs, nodeStatusMap, selectedNodeId: null });
    },

    selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

    clear: () =>
        set({
            selectedExecutionId: null,
            executionLogs: [],
            selectedNodeId: null,
            nodeStatusMap: {},
        }),
}));
