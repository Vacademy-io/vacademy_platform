import { useMemo, useState } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    NodeTypes,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AutomationDiagram, NodeType, WorkflowNode } from '@/types/workflow/workflow-types';
import { WorkflowNodeComponent } from './workflow-node-component';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface WorkflowDiagramViewerProps {
    diagram: AutomationDiagram;
    workflowName?: string;
}

function WorkflowDiagramContent({
    diagram,
    setSelectedNode,
}: {
    diagram: AutomationDiagram;
    setSelectedNode: (node: WorkflowNode | null) => void;
}) {
    // Convert API nodes to React Flow nodes
    const initialNodes: Node[] = useMemo(
        () =>
            diagram.nodes.map((node, index) => ({
                id: node.id,
                type: 'workflowNode',
                position: { x: 250, y: index * 200 + 50 },
                data: {
                    node,
                    onNodeClick: () => setSelectedNode(node),
                },
            })),
        [diagram.nodes, setSelectedNode]
    );

    // Convert API edges to React Flow edges
    const initialEdges: Edge[] = useMemo(
        () =>
            diagram.edges.map((edge) => ({
                id: edge.id,
                source: edge.sourceNodeId,
                target: edge.targetNodeId,
                label: edge.label,
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#94a3b8', strokeWidth: 2 },
                labelStyle: { fill: '#475569', fontWeight: 500, fontSize: 12 },
                labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
            })),
        [diagram.edges]
    );

    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [edges, , onEdgesChange] = useEdgesState(initialEdges);

    // Custom node types
    const nodeTypes: NodeTypes = useMemo(
        () => ({
            workflowNode: WorkflowNodeComponent,
        }),
        []
    );

    return (
        <div className="h-[600px] rounded-lg border border-neutral-200 bg-white">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
            >
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                <Controls />
                <MiniMap nodeStrokeWidth={3} zoomable pannable className="bg-neutral-50" />
            </ReactFlow>
        </div>
    );
}

export function WorkflowDiagramViewer({ diagram }: WorkflowDiagramViewerProps) {
    const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);

    const getNodeTypeColor = (type: NodeType): string => {
        const colors = {
            TRIGGER: 'bg-green-100 text-green-800 border-green-500',
            ACTION: 'bg-blue-100 text-blue-800 border-blue-500',
            DECISION: 'bg-yellow-100 text-yellow-800 border-yellow-500',
            EMAIL: 'bg-purple-100 text-purple-800 border-purple-500',
            NOTIFICATION: 'bg-indigo-100 text-indigo-800 border-indigo-500',
            DATABASE: 'bg-red-100 text-red-800 border-red-500',
            WEBHOOK: 'bg-orange-100 text-orange-800 border-orange-500',
            UNKNOWN: 'bg-gray-100 text-gray-800 border-gray-500',
        };
        return colors[type] || colors.UNKNOWN;
    };

    if (!diagram || diagram.nodes.length === 0) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50">
                <p className="text-lg font-medium text-neutral-500">
                    No workflow diagram available
                </p>
                <p className="text-sm text-neutral-400">
                    This workflow may not have any configured nodes
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-neutral-800">Automation Diagram</h2>
                    <p className="text-sm text-neutral-600">
                        {diagram.nodes.length} node{diagram.nodes.length !== 1 ? 's' : ''},{' '}
                        {diagram.edges.length} connection{diagram.edges.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>

            <ReactFlowProvider>
                <WorkflowDiagramContent diagram={diagram} setSelectedNode={setSelectedNode} />
            </ReactFlowProvider>

            {/* Node Details Modal */}
            <Dialog open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            {selectedNode?.title}
                            {selectedNode && (
                                <Badge className={getNodeTypeColor(selectedNode.type)}>
                                    {selectedNode.type}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedNode && (
                        <div className="space-y-4">
                            {selectedNode.description && (
                                <div>
                                    <span className="text-sm font-medium text-neutral-700">
                                        Description:
                                    </span>
                                    <p className="mt-1 text-sm text-neutral-600">
                                        {selectedNode.description}
                                    </p>
                                </div>
                            )}

                            {selectedNode.details &&
                                Object.keys(selectedNode.details).length > 0 && (
                                    <div>
                                        <span className="text-sm font-medium text-neutral-700">
                                            Configuration Details:
                                        </span>
                                        <div className="mt-2 max-h-96 space-y-2 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                                            {Object.entries(selectedNode.details).map(
                                                ([key, value]) => (
                                                    <div key={key} className="space-y-1">
                                                        <p className="text-sm font-medium text-neutral-700">
                                                            {key}:
                                                        </p>
                                                        <pre className="overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-xs text-neutral-600">
                                                            {typeof value === 'object'
                                                                ? JSON.stringify(value, null, 2)
                                                                : String(value)}
                                                        </pre>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
