import { useMemo, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { useQuery } from '@tanstack/react-query';
import { getExecutionLogsQuery, getWorkflowForEditing } from '@/services/workflow-service';
import { ExecutionFlowNode } from './execution-flow-node';
import { ExecutionTimeline } from './execution-timeline';
import { NodeLogPopover } from './node-log-popover';
import { useExecutionViewerStore } from '../-stores/execution-viewer-store';
import { WorkflowBuilderDTO } from '@/types/workflow/workflow-types';

const nodeTypes = { executionNode: ExecutionFlowNode };

interface Props {
    workflowId: string;
    executionId: string;
}

export function ExecutionFlowViewer({ workflowId, executionId }: Props) {
    const { executionLogs, nodeStatusMap, selectedNodeId, setExecution, selectNode } =
        useExecutionViewerStore();

    // Fetch workflow graph
    const { data: workflowData } = useQuery({
        queryKey: ['WORKFLOW_EDIT', workflowId],
        queryFn: async () => {
            const resp = await getWorkflowForEditing(workflowId);
            return resp as WorkflowBuilderDTO;
        },
        staleTime: 300_000,
    });

    // Fetch execution logs
    const { data: logs } = useQuery({
        ...getExecutionLogsQuery(executionId),
        enabled: !!executionId,
    });

    // Update store when logs arrive
    useMemo(() => {
        if (logs && executionId) {
            setExecution(executionId, logs);
        }
    }, [logs, executionId, setExecution]);

    // Build ReactFlow nodes from workflow graph + execution status
    const { nodes, edges } = useMemo(() => {
        if (!workflowData?.nodes) return { nodes: [], edges: [] };

        const rfNodes: Node[] = workflowData.nodes.map((n) => {
            const log = nodeStatusMap[n.id];
            return {
                id: n.id,
                type: 'executionNode',
                position: { x: n.position_x ?? 0, y: n.position_y ?? 0 },
                data: {
                    name: n.name,
                    nodeType: n.node_type,
                    executionStatus: log?.status ?? null,
                    executionTimeMs: log?.execution_time_ms ?? null,
                    hasError: !!log?.error_message,
                },
            };
        });

        const rfEdges: Edge[] = (workflowData.edges ?? []).map((e) => ({
            id: e.id,
            source: e.source_node_id,
            target: e.target_node_id,
            label: e.label ?? '',
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#94a3b8' },
        }));

        return { nodes: rfNodes, edges: rfEdges };
    }, [workflowData, nodeStatusMap]);

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            selectNode(node.id === selectedNodeId ? null : node.id);
        },
        [selectNode, selectedNodeId]
    );

    const selectedLog = selectedNodeId ? nodeStatusMap[selectedNodeId] ?? null : null;

    if (!workflowData) {
        return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading workflow...</div>;
    }

    return (
        <div className="space-y-3">
            <div className="relative border rounded-lg" style={{ height: 450 }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodeClick={onNodeClick}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                >
                    <Background />
                    <Controls />
                    <MiniMap />
                </ReactFlow>

                {/* Popover for selected node */}
                {selectedLog && (
                    <div className="absolute top-4 right-4 z-10">
                        <NodeLogPopover log={selectedLog} onClose={() => selectNode(null)} />
                    </div>
                )}
            </div>

            {/* Timeline */}
            {executionLogs.length > 0 && (
                <ExecutionTimeline
                    logs={executionLogs}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={selectNode}
                />
            )}
        </div>
    );
}
