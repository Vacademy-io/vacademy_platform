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
import { ArrowLeft, FloppyDisk, CheckCircle, Play, MagicWand } from '@phosphor-icons/react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createWorkflow, testRunWorkflow, validateWorkflow } from '@/services/workflow-service';
import { WorkflowBuilderDTO } from '@/types/workflow/workflow-types';
import { getUserId } from '@/utils/userDetails';
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
        scheduleConfig,
        triggerConfig,
        isSaving,
        selectedNodeId,
        onNodesChange,
        onEdgesChange,
        onConnect,
        selectNode,
        setWorkflowName,
        setWorkflowDescription,
        setWorkflowType,
        setScheduleConfig,
        setTriggerConfig,
        setIsSaving,
        reset,
    } = useWorkflowBuilderStore();

    const [testRunResult, setTestRunResult] = useState<Record<string, unknown> | null>(null);
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const addNode = useWorkflowBuilderStore((s) => s.addNode);
    const isDirty = useWorkflowBuilderStore((s) => s.isDirty);

    useEffect(() => {
        setNavHeading('Create Workflow');
        return () => {
            reset();
        };
    }, []);

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: { id: string }) => {
            selectNode(node.id);
        },
        [selectNode]
    );

    const onPaneClick = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    const buildDTO = (status: string): WorkflowBuilderDTO => ({
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
        ...(workflowType === 'SCHEDULED' && {
            schedule: {
                schedule_type: scheduleConfig.scheduleType,
                cron_expression: scheduleConfig.scheduleType === 'CRON' ? scheduleConfig.cronExpression : undefined,
                interval_minutes: scheduleConfig.scheduleType === 'INTERVAL' ? scheduleConfig.intervalMinutes : undefined,
                timezone: scheduleConfig.timezone,
                start_date: scheduleConfig.startDate || undefined,
                end_date: scheduleConfig.endDate || undefined,
            },
        }),
        ...(workflowType === 'EVENT_DRIVEN' && triggerConfig.eventName && {
            trigger: {
                trigger_event_name: triggerConfig.eventName,
                description: triggerConfig.description || undefined,
            },
        }),
    });

    const runClientValidation = (): string[] => {
        const errors: string[] = [];
        if (!workflowName.trim()) errors.push('Workflow name is required');
        if (nodes.length === 0) errors.push('Add at least one node');
        if (workflowType === 'EVENT_DRIVEN' && !triggerConfig.eventName) {
            errors.push('Select a trigger event for event-driven workflows');
        }
        if (workflowType === 'SCHEDULED' && !scheduleConfig.cronExpression && scheduleConfig.scheduleType === 'CRON') {
            errors.push('Enter a cron expression for scheduled workflows');
        }
        // Check for disconnected nodes (nodes with no edges)
        if (nodes.length > 1) {
            const connectedIds = new Set<string>();
            edges.forEach((e) => { connectedIds.add(e.source); connectedIds.add(e.target); });
            const disconnected = nodes.filter((n) => !connectedIds.has(n.id));
            if (disconnected.length > 0) {
                errors.push(`${disconnected.length} node(s) not connected: ${disconnected.map((n) => n.data.name).join(', ')}`);
            }
        }
        return errors;
    };

    const handleSave = async (status: string) => {
        const errors = runClientValidation();
        if (errors.length > 0) {
            setValidationErrors(errors);
            return;
        }
        setValidationErrors([]);
        setIsSaving(true);
        try {
            const dto = buildDTO(status);

            // Run server-side validation for ACTIVE (publish)
            if (status === 'ACTIVE') {
                try {
                    const serverErrors = await validateWorkflow(dto);
                    if (serverErrors && serverErrors.length > 0) {
                        setValidationErrors(serverErrors.map((e: { message?: string; field?: string }) =>
                            `${e.field ? e.field + ': ' : ''}${e.message ?? 'Validation error'}`
                        ));
                        setIsSaving(false);
                        return;
                    }
                } catch {
                    // Validation endpoint may not be available — proceed with save
                }
            }

            await createWorkflow(dto, getUserId());
            navigate({ to: '/workflow/list' });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setValidationErrors([`Failed to save: ${msg}`]);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestRun = async () => {
        if (nodes.length === 0) {
            setValidationErrors(['Add at least one node before testing']);
            return;
        }
        setIsTestRunning(true);
        setTestRunResult(null);
        setValidationErrors([]);
        try {
            const dto = buildDTO('DRAFT');
            const saved = await createWorkflow(dto, getUserId());
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
                        <MagicWand size={14} />
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

            {/* Validation errors banner */}
            {validationErrors.length > 0 && (
                <div className="bg-red-50 border-b border-red-200 px-4 py-2">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-red-700">
                            {validationErrors.map((err, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <span className="text-red-500">•</span> {err}
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setValidationErrors([])} className="text-red-400 hover:text-red-600 text-xs">
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

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
                        deleteKeyCode="Backspace"
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
                        <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
                            <h3 className="text-sm font-semibold text-gray-700">
                                Workflow Settings
                            </h3>
                            <div>
                                <Label className="text-xs">Description</Label>
                                <textarea
                                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    rows={2}
                                    value={workflowDescription}
                                    onChange={(e) =>
                                        setWorkflowDescription(e.target.value)
                                    }
                                    placeholder="Describe what this workflow does..."
                                />
                            </div>

                            {/* Schedule config for SCHEDULED workflows */}
                            {workflowType === 'SCHEDULED' && (
                                <div className="space-y-3 border-t pt-3">
                                    <h4 className="text-xs font-semibold text-gray-600 uppercase">Schedule</h4>
                                    <div>
                                        <Label className="text-xs">Schedule Type</Label>
                                        <select
                                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={scheduleConfig.scheduleType}
                                            onChange={(e) => setScheduleConfig({ scheduleType: e.target.value as 'CRON' | 'INTERVAL' })}
                                        >
                                            <option value="CRON">Cron Expression</option>
                                            <option value="INTERVAL">Fixed Interval</option>
                                        </select>
                                    </div>
                                    {scheduleConfig.scheduleType === 'CRON' ? (
                                        <div>
                                            <Label className="text-xs">Cron Expression</Label>
                                            <Input
                                                value={scheduleConfig.cronExpression}
                                                onChange={(e) => setScheduleConfig({ cronExpression: e.target.value })}
                                                className="mt-1 font-mono text-xs"
                                                placeholder="0 0 9 * * ?"
                                            />
                                            <p className="mt-1 text-[10px] text-gray-400">
                                                Quartz format: sec min hr day month weekday.
                                                E.g. "0 0 9 * * ?" = daily at 9 AM
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <Label className="text-xs">Interval (minutes)</Label>
                                            <Input
                                                type="number"
                                                value={scheduleConfig.intervalMinutes}
                                                onChange={(e) => setScheduleConfig({ intervalMinutes: parseInt(e.target.value) || 60 })}
                                                className="mt-1"
                                                min={1}
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <Label className="text-xs">Timezone</Label>
                                        <select
                                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={scheduleConfig.timezone}
                                            onChange={(e) => setScheduleConfig({ timezone: e.target.value })}
                                        >
                                            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                                            <option value="UTC">UTC</option>
                                            <option value="America/New_York">America/New_York (EST)</option>
                                            <option value="Europe/London">Europe/London (GMT)</option>
                                            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Start Date</Label>
                                        <Input
                                            type="datetime-local"
                                            value={scheduleConfig.startDate}
                                            onChange={(e) => setScheduleConfig({ startDate: e.target.value })}
                                            className="mt-1 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs">End Date (optional)</Label>
                                        <Input
                                            type="datetime-local"
                                            value={scheduleConfig.endDate}
                                            onChange={(e) => setScheduleConfig({ endDate: e.target.value })}
                                            className="mt-1 text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Trigger config for EVENT_DRIVEN workflows */}
                            {workflowType === 'EVENT_DRIVEN' && (
                                <div className="space-y-3 border-t pt-3">
                                    <h4 className="text-xs font-semibold text-gray-600 uppercase">Trigger Event</h4>
                                    <div>
                                        <Label className="text-xs">Event</Label>
                                        <select
                                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={triggerConfig.eventName}
                                            onChange={(e) => {
                                                const eventName = e.target.value;
                                                setTriggerConfig({ eventName });

                                                // Auto-create or update the TRIGGER node on canvas
                                                const store = useWorkflowBuilderStore.getState();
                                                const existingTrigger = store.nodes.find((n) => n.data.nodeType === 'TRIGGER');
                                                if (eventName) {
                                                    if (existingTrigger) {
                                                        // Update existing trigger node's config
                                                        store.updateNodeConfig(existingTrigger.id, {
                                                            ...existingTrigger.data.config,
                                                            triggerEvent: eventName,
                                                        });
                                                        store.updateNodeName(existingTrigger.id, `Trigger: ${eventName.replace(/_/g, ' ').toLowerCase()}`);
                                                    } else {
                                                        // Add new trigger node at top-center
                                                        store.addNode('TRIGGER', `Trigger: ${eventName.replace(/_/g, ' ').toLowerCase()}`, { x: 250, y: 50 });
                                                        // Set its config
                                                        const newNodes = useWorkflowBuilderStore.getState().nodes;
                                                        const newTrigger = newNodes.find((n) => n.data.nodeType === 'TRIGGER');
                                                        if (newTrigger) {
                                                            store.updateNodeConfig(newTrigger.id, { triggerEvent: eventName });
                                                        }
                                                    }
                                                }
                                            }}
                                        >
                                            <option value="">Select an event...</option>
                                            <option value="LEARNER_BATCH_ENROLLMENT">Learner Batch Enrollment</option>
                                            <option value="GENERATE_ADMIN_LOGIN_URL_FOR_LEARNER_PORTAL">Generate Admin Login URL</option>
                                            <option value="SEND_LEARNER_CREDENTIALS">Send Learner Credentials</option>
                                            <option value="SUB_ORG_MEMBER_ENROLLMENT">Sub-Org Member Enrollment</option>
                                            <option value="SUB_ORG_MEMBER_TERMINATION">Sub-Org Member Termination</option>
                                            <option value="AUDIENCE_LEAD_SUBMISSION">Audience Lead Submission</option>
                                            <option value="INSTALLMENT_DUE_REMINDER">Installment Due Reminder</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Description (optional)</Label>
                                        <Input
                                            value={triggerConfig.description}
                                            onChange={(e) => setTriggerConfig({ description: e.target.value })}
                                            className="mt-1"
                                            placeholder="What triggers this workflow?"
                                        />
                                    </div>
                                </div>
                            )}

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
