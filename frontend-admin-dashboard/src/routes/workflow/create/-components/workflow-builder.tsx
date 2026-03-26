import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, FloppyDisk, CheckCircle, Play, Wand } from '@phosphor-icons/react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createWorkflow, testRunWorkflow } from '@/services/workflow-service';
import { WorkflowBuilderDTO } from '@/types/workflow/workflow-types';
import { useWorkflowBuilderStore } from '../-stores/workflow-builder-store';
import { WorkflowCustomNode } from './workflow-custom-node';
import { NodePalette } from './node-palette';
import { NodeConfigPanel } from './node-config-panel';
import { TemplateGallery } from './template-gallery';
import { NodeSuggestions } from './node-suggestions';
import { WorkflowWizard } from './workflow-wizard';

const nodeTypes = { workflowNode: WorkflowCustomNode };

function WorkflowBuilderInner() {
    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();
    const { data: instituteData } = useSuspenseQuery(useInstituteQuery());
    const instituteId = instituteData?.id ?? '';

    const {
        nodes,
        edges,
        workflowName,
        workflowDescription,
        workflowType,
        isSaving,
        selectedNodeId,
        onNodesChange,
        onEdgesChange,
        onConnect,
        selectNode,
        setWorkflowName,
        setWorkflowDescription,
        setWorkflowType,
        setIsSaving,
        reset,
    } = useWorkflowBuilderStore();

    const [testRunResult, setTestRunResult] = useState<Record<string, unknown> | null>(null);
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [wizardOpen, setWizardOpen] = useState(false);

    const addNode = useWorkflowBuilderStore((s) => s.addNode);

    useEffect(() => {
        setNavHeading('Create Workflow');
        return () => {
            reset();
        };
    }, []);

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: { id: string }) => {
            selectNode(node.id);
        },
        [selectNode]
    );

    const onPaneClick = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    const handleSave = async (status: string) => {
        if (!workflowName.trim()) {
            alert('Please enter a workflow name');
            return;
        }
        if (nodes.length === 0) {
            alert('Please add at least one node');
            return;
        }

        setIsSaving(true);
        try {
            const dto: WorkflowBuilderDTO = {
                name: workflowName,
                description: workflowDescription,
                status,
                workflow_type: workflowType,
                institute_id: instituteId,
                nodes: nodes.map((n, i) => ({
                    id: n.id,
                    name: n.data.name,
                    node_type: n.data.nodeType,
                    config: n.data.config ?? {},
                    position_x: n.position.x,
                    position_y: n.position.y,
                    is_start_node: n.data.isStartNode ?? i === 0,
                    is_end_node: n.data.isEndNode ?? false,
                })),
                edges: edges.map((e) => ({
                    id: e.id,
                    source_node_id: e.source,
                    target_node_id: e.target,
                    label: (e.label as string) ?? '',
                })),
            };

            await createWorkflow(dto, 'admin');
            navigate({ to: '/workflow/list' });
        } catch (err) {
            console.error('Failed to save workflow:', err);
            alert('Failed to save workflow. Check console for details.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestRun = async () => {
        if (nodes.length === 0) {
            alert('Please add at least one node');
            return;
        }
        setIsTestRunning(true);
        setTestRunResult(null);
        try {
            // First save as draft to get an ID
            const dto: WorkflowBuilderDTO = {
                name: workflowName || 'Test Workflow',
                description: workflowDescription,
                status: 'DRAFT',
                workflow_type: workflowType,
                institute_id: instituteId,
                nodes: nodes.map((n, i) => ({
                    id: n.id,
                    name: n.data.name,
                    node_type: n.data.nodeType,
                    config: n.data.config ?? {},
                    position_x: n.position.x,
                    position_y: n.position.y,
                    is_start_node: n.data.isStartNode ?? i === 0,
                    is_end_node: n.data.isEndNode ?? false,
                })),
                edges: edges.map((e) => ({
                    id: e.id,
                    source_node_id: e.source,
                    target_node_id: e.target,
                    label: (e.label as string) ?? '',
                })),
            };
            const saved = await createWorkflow(dto, 'admin');
            if (saved.id) {
                const result = await testRunWorkflow(saved.id);
                setTestRunResult(result);
            }
        } catch (err) {
            console.error('Test run failed:', err);
            alert('Test run failed. Check console for details.');
        } finally {
            setIsTestRunning(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-3 border-b bg-white px-4 py-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate({ to: '/workflow/list' })}
                >
                    <ArrowLeft size={16} />
                </Button>

                <div className="flex items-center gap-2">
                    <Input
                        value={workflowName}
                        onChange={(e) => setWorkflowName(e.target.value)}
                        placeholder="Workflow name..."
                        className="h-8 w-64 text-sm font-medium"
                    />
                </div>

                <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={workflowType}
                    onChange={(e) =>
                        setWorkflowType(
                            e.target.value as 'SCHEDULED' | 'EVENT_DRIVEN'
                        )
                    }
                >
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="EVENT_DRIVEN">Event-Driven</option>
                </select>

                <div className="ml-auto flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWizardOpen(true)}
                        className="gap-1.5"
                    >
                        <Wand size={14} />
                        Wizard
                    </Button>
                    <TemplateGallery instituteId={instituteId} />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestRun}
                        disabled={isTestRunning || nodes.length === 0}
                        className="gap-1.5"
                    >
                        <Play size={14} />
                        {isTestRunning ? 'Running...' : 'Test Run'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSave('DRAFT')}
                        disabled={isSaving}
                        className="gap-1.5"
                    >
                        <FloppyDisk size={14} />
                        Save Draft
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => handleSave('ACTIVE')}
                        disabled={isSaving}
                        className="gap-1.5"
                    >
                        <CheckCircle size={14} />
                        Publish
                    </Button>
                </div>
            </div>

            {/* Main layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: Node palette */}
                <div className="w-56 border-r bg-gray-50">
                    <NodePalette />
                </div>

                {/* Center: ReactFlow canvas */}
                <div className="flex-1">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        fitView
                        className="bg-gray-100"
                    >
                        <Background gap={20} size={1} />
                        <Controls />
                        <MiniMap
                            nodeStrokeWidth={3}
                            zoomable
                            pannable
                            className="!bg-white !border !border-gray-200 !rounded-lg"
                        />
                    </ReactFlow>
                </div>

                {/* Right: Config panel */}
                <div className="w-72 border-l bg-white">
                    {selectedNodeId ? (
                        <NodeConfigPanel />
                    ) : (
                        <div className="flex flex-col gap-4 p-4">
                            <h3 className="text-sm font-semibold text-gray-700">
                                Workflow Settings
                            </h3>
                            <div>
                                <Label className="text-xs">Description</Label>
                                <textarea
                                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    rows={3}
                                    value={workflowDescription}
                                    onChange={(e) =>
                                        setWorkflowDescription(e.target.value)
                                    }
                                    placeholder="Describe what this workflow does..."
                                />
                            </div>
                            <div className="rounded-lg border bg-gray-50 p-3">
                                <p className="text-xs text-gray-500">
                                    <strong>{nodes.length}</strong> nodes,{' '}
                                    <strong>{edges.length}</strong> connections
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Smart suggestions when a node is selected */}
            {selectedNodeId && (() => {
                const selectedNode = nodes.find((n) => n.id === selectedNodeId);
                return selectedNode ? (
                    <div className="border-t px-4 py-2">
                        <NodeSuggestions
                            currentNodeType={selectedNode.data.nodeType}
                            onAddNode={(type) => {
                                const meta = nodes.find((n) => n.id === selectedNodeId);
                                const pos = meta
                                    ? { x: meta.position.x, y: meta.position.y + 180 }
                                    : undefined;
                                addNode(type, type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), pos);
                            }}
                        />
                    </div>
                ) : null;
            })()}

            {/* Workflow wizard dialog */}
            <WorkflowWizard
                open={wizardOpen}
                onOpenChange={setWizardOpen}
                instituteId={instituteId}
                onApplyTemplate={(templateJson, name) => {
                    try {
                        const parsed = JSON.parse(templateJson);
                        if (parsed.nodes) {
                            const { setNodes, setEdges, setWorkflowName } = useWorkflowBuilderStore.getState();
                            setWorkflowName(name);
                            const rfNodes = parsed.nodes.map((n: Record<string, unknown>) => ({
                                id: n.id ?? `node-${Math.random().toString(36).slice(2)}`,
                                type: 'workflowNode',
                                position: { x: (n.position_x as number) ?? 0, y: (n.position_y as number) ?? 0 },
                                data: {
                                    name: n.name ?? n.node_type,
                                    nodeType: n.node_type,
                                    config: n.config ?? {},
                                    isStartNode: n.is_start_node ?? false,
                                },
                            }));
                            const rfEdges = (parsed.edges ?? []).map((e: Record<string, unknown>) => ({
                                id: e.id ?? `edge-${Math.random().toString(36).slice(2)}`,
                                source: e.source_node_id,
                                target: e.target_node_id,
                                label: e.label ?? '',
                                type: 'smoothstep',
                                animated: true,
                            }));
                            setNodes(rfNodes);
                            setEdges(rfEdges);
                        }
                    } catch (err) {
                        console.error('Failed to parse template:', err);
                    }
                }}
            />

            {testRunResult && (
                <div className="border-t bg-gray-50 p-4 max-h-48 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">Test Run Results (Dry Run)</h4>
                        <Button variant="ghost" size="sm" onClick={() => setTestRunResult(null)}>
                            Dismiss
                        </Button>
                    </div>
                    <pre className="text-xs bg-white rounded border p-3 overflow-x-auto">
                        {JSON.stringify(testRunResult, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

export function WorkflowBuilder() {
    return (
        <ReactFlowProvider>
            <WorkflowBuilderInner />
        </ReactFlowProvider>
    );
}
