import { useWorkflowBuilderStore } from '../-stores/workflow-builder-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash, X } from '@phosphor-icons/react';
import { WORKFLOW_NODE_TYPES } from '@/types/workflow/workflow-types';
import { VariablePicker } from './variable-picker';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import {
    getQueryKeysQuery,
    getTriggerEventsCatalogQuery,
    getTemplatesByTypeQuery,
} from '@/services/workflow-service';

export function NodeConfigPanel() {
    const selectedNodeId = useWorkflowBuilderStore((s) => s.selectedNodeId);
    const nodes = useWorkflowBuilderStore((s) => s.nodes);
    const updateNodeConfig = useWorkflowBuilderStore((s) => s.updateNodeConfig);
    const updateNodeName = useWorkflowBuilderStore((s) => s.updateNodeName);
    const removeNode = useWorkflowBuilderStore((s) => s.removeNode);
    const selectNode = useWorkflowBuilderStore((s) => s.selectNode);

    // Fetch institute data for template queries
    const { data: instituteData } = useSuspenseQuery(useInstituteQuery());
    const instituteId = instituteData?.id ?? '';

    // Fetch catalog data
    const { data: queryKeys } = useQuery(getQueryKeysQuery());
    const { data: triggerEvents } = useQuery(getTriggerEventsCatalogQuery());
    const { data: emailTemplates } = useQuery(getTemplatesByTypeQuery(instituteId, 'EMAIL'));
    const { data: whatsappTemplates } = useQuery(getTemplatesByTypeQuery(instituteId, 'WHATSAPP'));

    const selectedNode = nodes.find((n) => n.id === selectedNodeId);

    if (!selectedNode) {
        return (
            <div className="flex h-full items-center justify-center p-4 text-sm text-gray-400">
                Select a node to configure
            </div>
        );
    }

    const data = selectedNode.data as {
        name: string;
        nodeType: string;
        config: Record<string, unknown>;
    };
    const nodeMeta = WORKFLOW_NODE_TYPES.find((t) => t.type === data.nodeType);

    const handleConfigChange = (key: string, value: unknown) => {
        updateNodeConfig(selectedNode.id, { ...data.config, [key]: value });
    };

    // Derived values for catalog lookups
    const selectedQueryKey = queryKeys?.find((q) => q.key === (data.config.prebuiltKey as string));
    const selectedTriggerEvent = triggerEvents?.find((e) => e.key === (data.config.triggerEvent as string));

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b p-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{nodeMeta?.icon ?? '?'}</span>
                    <span className="text-sm font-semibold">
                        {nodeMeta?.label ?? data.nodeType}
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selectNode(null)}
                >
                    <X size={16} />
                </Button>
            </div>

            <div className="flex flex-col gap-4 p-4">
                <div>
                    <Label className="text-xs">Node Name</Label>
                    <Input
                        value={data.name}
                        onChange={(e) =>
                            updateNodeName(selectedNode.id, e.target.value)
                        }
                        className="mt-1"
                        placeholder="Enter node name"
                    />
                </div>

                {/* Trigger-specific config — upgraded with catalog dropdown */}
                {data.nodeType === 'TRIGGER' && (
                    <div>
                        <Label className="text-xs">Trigger Event</Label>
                        <select
                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={(data.config.triggerEvent as string) ?? ''}
                            onChange={(e) =>
                                handleConfigChange('triggerEvent', e.target.value)
                            }
                        >
                            <option value="">Select event...</option>
                            {triggerEvents?.map((ev) => (
                                <option key={ev.key} value={ev.key}>
                                    {ev.label}
                                </option>
                            ))}
                        </select>
                        {selectedTriggerEvent && (
                            <p className="mt-1 text-[10px] text-gray-400">{selectedTriggerEvent.description}</p>
                        )}
                    </div>
                )}

                {/* Email node config — upgraded with template dropdown + dynamic params */}
                {data.nodeType === 'SEND_EMAIL' && (
                    <>
                        <div>
                            <Label className="text-xs">Email Template</Label>
                            <select
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={(data.config.templateName as string) ?? ''}
                                onChange={(e) => {
                                    handleConfigChange('templateName', e.target.value);
                                    const tmpl = emailTemplates?.find((t) => t.name === e.target.value);
                                    if (tmpl?.dynamic_parameters) {
                                        try {
                                            const params = JSON.parse(tmpl.dynamic_parameters);
                                            handleConfigChange('_templateParams', params);
                                        } catch {
                                            // ignore parse errors
                                        }
                                    }
                                }}
                            >
                                <option value="">Select template...</option>
                                {emailTemplates?.map((t) => (
                                    <option key={t.id} value={t.name}>
                                        {t.name} {t.subject ? `— ${t.subject}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">Recipients (list expression)</Label>
                            <VariablePicker
                                value={(data.config.on as string) ?? ''}
                                onChange={(v) => handleConfigChange('on', v)}
                                placeholder="Pick a list of recipients..."
                                nodeId={selectedNode.id}
                            />
                        </div>
                        {/* Dynamic template parameters */}
                        {data.config._templateParams && typeof data.config._templateParams === 'object' && (
                            <div className="space-y-2 border-t pt-2 mt-2">
                                <Label className="text-[10px] uppercase text-gray-400">Template Variables</Label>
                                {Object.entries(data.config._templateParams as Record<string, string>).map(([key, label]) => (
                                    <div key={key}>
                                        <Label className="text-xs">{label || key}</Label>
                                        <VariablePicker
                                            value={((data.config.templateVars as Record<string, string>)?.[key]) ?? ''}
                                            onChange={(v) => {
                                                const vars = { ...(data.config.templateVars as Record<string, string> ?? {}), [key]: v };
                                                handleConfigChange('templateVars', vars);
                                            }}
                                            placeholder={`Value for ${label || key}...`}
                                            nodeId={selectedNode.id}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* WhatsApp node config — upgraded with template dropdown + dynamic params */}
                {data.nodeType === 'SEND_WHATSAPP' && (
                    <>
                        <div>
                            <Label className="text-xs">WhatsApp Template</Label>
                            <select
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={(data.config.templateName as string) ?? ''}
                                onChange={(e) => {
                                    handleConfigChange('templateName', e.target.value);
                                    const tmpl = whatsappTemplates?.find((t) => t.name === e.target.value);
                                    if (tmpl?.dynamic_parameters) {
                                        try {
                                            const params = JSON.parse(tmpl.dynamic_parameters);
                                            handleConfigChange('_templateParams', params);
                                        } catch {
                                            // ignore parse errors
                                        }
                                    }
                                }}
                            >
                                <option value="">Select template...</option>
                                {whatsappTemplates?.map((t) => (
                                    <option key={t.id} value={t.name}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">Recipients (list expression)</Label>
                            <VariablePicker
                                value={(data.config.on as string) ?? ''}
                                onChange={(v) => handleConfigChange('on', v)}
                                placeholder="Pick a list of recipients..."
                                nodeId={selectedNode.id}
                            />
                        </div>
                        {/* Dynamic template parameters */}
                        {data.config._templateParams && typeof data.config._templateParams === 'object' && (
                            <div className="space-y-2 border-t pt-2 mt-2">
                                <Label className="text-[10px] uppercase text-gray-400">Template Variables</Label>
                                {Object.entries(data.config._templateParams as Record<string, string>).map(([key, label]) => (
                                    <div key={key}>
                                        <Label className="text-xs">{label || key}</Label>
                                        <VariablePicker
                                            value={((data.config.templateVars as Record<string, string>)?.[key]) ?? ''}
                                            onChange={(v) => {
                                                const vars = { ...(data.config.templateVars as Record<string, string> ?? {}), [key]: v };
                                                handleConfigChange('templateVars', vars);
                                            }}
                                            placeholder={`Value for ${label || key}...`}
                                            nodeId={selectedNode.id}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* HTTP Request config — upgraded with type toggle */}
                {data.nodeType === 'HTTP_REQUEST' && (
                    <>
                        <div>
                            <Label className="text-xs">Request Type</Label>
                            <select
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={(data.config.requestType as string) ?? 'EXTERNAL'}
                                onChange={(e) => handleConfigChange('requestType', e.target.value)}
                            >
                                <option value="EXTERNAL">External API</option>
                                <option value="INTERNAL">Internal Service</option>
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">URL</Label>
                            <Input
                                value={(data.config.url as string) ?? ''}
                                onChange={(e) =>
                                    handleConfigChange('url', e.target.value)
                                }
                                className="mt-1"
                                placeholder={
                                    (data.config.requestType as string) === 'INTERNAL'
                                        ? '/admin-core-service/v1/...'
                                        : 'https://api.example.com/endpoint'
                                }
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Method</Label>
                            <select
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={
                                    (data.config.method as string) ?? 'GET'
                                }
                                onChange={(e) =>
                                    handleConfigChange(
                                        'method',
                                        e.target.value
                                    )
                                }
                            >
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                            </select>
                        </div>
                    </>
                )}

                {/* Query node config — upgraded with catalog dropdown + dynamic params */}
                {data.nodeType === 'QUERY' && (
                    <>
                        <div>
                            <Label className="text-xs">Query</Label>
                            <select
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={(data.config.prebuiltKey as string) ?? ''}
                                onChange={(e) => handleConfigChange('prebuiltKey', e.target.value)}
                            >
                                <option value="">Select a query...</option>
                                {queryKeys?.map((q) => (
                                    <option key={q.key} value={q.key}>
                                        {q.label}
                                    </option>
                                ))}
                            </select>
                            {selectedQueryKey && (
                                <p className="mt-1 text-[10px] text-gray-400">{selectedQueryKey.description}</p>
                            )}
                        </div>
                        {/* Dynamic required params */}
                        {selectedQueryKey?.required_params && selectedQueryKey.required_params.length > 0 && (
                            <div className="space-y-2 border-t pt-2 mt-2">
                                <Label className="text-[10px] uppercase text-gray-400">Required Parameters</Label>
                                {selectedQueryKey.required_params.map((param) => (
                                    <div key={param}>
                                        <Label className="text-xs">{param}</Label>
                                        <VariablePicker
                                            value={(data.config[param] as string) ?? ''}
                                            onChange={(v) => handleConfigChange(param, v)}
                                            placeholder={`Pick value for ${param}...`}
                                            nodeId={selectedNode.id}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        <div>
                            <Label className="text-xs">Result Key</Label>
                            <Input
                                value={(data.config.resultKey as string) ?? 'queryResult'}
                                onChange={(e) => handleConfigChange('resultKey', e.target.value)}
                                className="mt-1"
                                placeholder="queryResult"
                            />
                        </div>
                    </>
                )}

                {/* Delay node config */}
                {data.nodeType === 'DELAY' && (
                    <>
                        <div>
                            <Label className="text-xs">Delay Value</Label>
                            <Input
                                type="number"
                                value={(data.config.delayValue as number) ?? 5}
                                onChange={(e) => handleConfigChange('delayValue', parseInt(e.target.value) || 0)}
                                className="mt-1"
                                min={0}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Unit</Label>
                            <select
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={(data.config.delayUnit as string) ?? 'SECONDS'}
                                onChange={(e) => handleConfigChange('delayUnit', e.target.value)}
                            >
                                <option value="SECONDS">Seconds</option>
                                <option value="MINUTES">Minutes</option>
                                <option value="HOURS">Hours</option>
                            </select>
                        </div>
                    </>
                )}

                {/* Filter node config */}
                {data.nodeType === 'FILTER' && (
                    <>
                        <div>
                            <Label className="text-xs">Source Expression</Label>
                            <VariablePicker
                                value={(data.config.source as string) ?? ''}
                                onChange={(v) => handleConfigChange('source', v)}
                                placeholder="Pick a list variable..."
                                nodeId={selectedNode.id}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Filter Condition (SpEL)</Label>
                            <Input
                                value={(data.config.condition as string) ?? ''}
                                onChange={(e) => handleConfigChange('condition', e.target.value)}
                                className="mt-1"
                                placeholder="#item['age'] > 18"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Output Key</Label>
                            <Input
                                value={(data.config.outputKey as string) ?? 'filteredList'}
                                onChange={(e) => handleConfigChange('outputKey', e.target.value)}
                                className="mt-1"
                                placeholder="filteredList"
                            />
                        </div>
                    </>
                )}

                {/* Aggregate node config */}
                {data.nodeType === 'AGGREGATE' && (
                    <>
                        <div>
                            <Label className="text-xs">Source Expression</Label>
                            <VariablePicker
                                value={(data.config.source as string) ?? ''}
                                onChange={(v) => handleConfigChange('source', v)}
                                placeholder="Pick a list variable..."
                                nodeId={selectedNode.id}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Operations (JSON)</Label>
                            <textarea
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                                rows={6}
                                value={
                                    (data.config.operations as string) ??
                                    JSON.stringify(
                                        [
                                            { type: 'COUNT', outputKey: 'total' },
                                            { type: 'AVG', field: 'score', outputKey: 'avgScore' },
                                        ],
                                        null,
                                        2
                                    )
                                }
                                onChange={(e) => {
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        handleConfigChange('operations', parsed);
                                    } catch {
                                        // Store raw string while editing
                                        handleConfigChange('operations', e.target.value);
                                    }
                                }}
                            />
                            <p className="mt-1 text-[10px] text-gray-400">
                                Types: COUNT, SUM, AVG, MIN, MAX. Each needs outputKey, SUM/AVG/MIN/MAX need field.
                            </p>
                        </div>
                    </>
                )}

                {/* Condition (If/Else) node config */}
                {data.nodeType === 'CONDITION' && (
                    <>
                        <div>
                            <Label className="text-xs">Condition Expression</Label>
                            <VariablePicker
                                value={(data.config.condition as string) ?? ''}
                                onChange={(v) => handleConfigChange('condition', v)}
                                placeholder="Pick a variable to check..."
                                nodeId={selectedNode.id}
                            />
                            <p className="mt-1 text-[10px] text-gray-400">
                                Must evaluate to true/false. Use Advanced mode for complex expressions like "#ctx['age'] &gt; 18".
                            </p>
                        </div>
                        <div>
                            <Label className="text-xs">True Label</Label>
                            <Input
                                value={(data.config.trueLabel as string) ?? 'Yes'}
                                onChange={(e) => handleConfigChange('trueLabel', e.target.value)}
                                className="mt-1"
                                placeholder="Yes"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">False Label</Label>
                            <Input
                                value={(data.config.falseLabel as string) ?? 'No'}
                                onChange={(e) => handleConfigChange('falseLabel', e.target.value)}
                                className="mt-1"
                                placeholder="No"
                            />
                        </div>
                    </>
                )}

                {/* Loop (forEach) node config */}
                {data.nodeType === 'LOOP' && (
                    <>
                        <div>
                            <Label className="text-xs">Source Expression</Label>
                            <VariablePicker
                                value={(data.config.source as string) ?? ''}
                                onChange={(v) => handleConfigChange('source', v)}
                                placeholder="Pick a list variable..."
                                nodeId={selectedNode.id}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Item Variable Name</Label>
                            <Input
                                value={(data.config.itemVariable as string) ?? 'item'}
                                onChange={(e) => handleConfigChange('itemVariable', e.target.value)}
                                className="mt-1"
                                placeholder="item"
                            />
                            <p className="mt-1 text-[10px] text-gray-400">
                                Access each item in downstream nodes as #ctx['{'{'}variableName{'}'}']
                            </p>
                        </div>
                        <div>
                            <Label className="text-xs">Output Key</Label>
                            <Input
                                value={(data.config.outputKey as string) ?? 'loopResults'}
                                onChange={(e) => handleConfigChange('outputKey', e.target.value)}
                                className="mt-1"
                                placeholder="loopResults"
                            />
                        </div>
                    </>
                )}

                {/* Merge node config */}
                {data.nodeType === 'MERGE' && (
                    <>
                        <div>
                            <Label className="text-xs">Wait For Node IDs (comma-separated)</Label>
                            <Input
                                value={(data.config.waitFor as string) ?? ''}
                                onChange={(e) => handleConfigChange('waitFor', e.target.value)}
                                className="mt-1"
                                placeholder="node-id-1, node-id-2"
                            />
                            <p className="mt-1 text-[10px] text-gray-400">
                                IDs of upstream nodes whose output must be present before continuing.
                            </p>
                        </div>
                        <div>
                            <Label className="text-xs">Strategy</Label>
                            <select
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={(data.config.strategy as string) ?? 'ALL'}
                                onChange={(e) => handleConfigChange('strategy', e.target.value)}
                            >
                                <option value="ALL">Wait for ALL upstream nodes</option>
                                <option value="ANY">Continue when ANY upstream completes</option>
                            </select>
                        </div>
                    </>
                )}

                {/* Schedule Task node config */}
                {data.nodeType === 'SCHEDULE_TASK' && (
                    <>
                        <div>
                            <Label className="text-xs">Delay Duration (ISO-8601)</Label>
                            <Input
                                value={(data.config.delayDuration as string) ?? 'PT1H'}
                                onChange={(e) => handleConfigChange('delayDuration', e.target.value)}
                                className="mt-1"
                                placeholder="PT1H, P3D, PT30M"
                            />
                            <p className="mt-1 text-[10px] text-gray-400">
                                PT1H = 1 hour, P3D = 3 days, PT30M = 30 minutes
                            </p>
                        </div>
                        <div>
                            <Label className="text-xs">Target Workflow ID (optional)</Label>
                            <Input
                                value={(data.config.workflowId as string) ?? ''}
                                onChange={(e) => handleConfigChange('workflowId', e.target.value)}
                                className="mt-1"
                                placeholder="Leave empty for current workflow"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Context Keys to Forward (comma-separated)</Label>
                            <Input
                                value={(data.config.contextForward as string) ?? ''}
                                onChange={(e) => handleConfigChange('contextForward', e.target.value)}
                                className="mt-1"
                                placeholder="userList, instituteId"
                            />
                        </div>
                    </>
                )}

                {/* Update Record node config */}
                {data.nodeType === 'UPDATE_RECORD' && (
                    <>
                        <div>
                            <Label className="text-xs">Table</Label>
                            <select
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={(data.config.table as string) ?? ''}
                                onChange={(e) => handleConfigChange('table', e.target.value)}
                            >
                                <option value="">Select table...</option>
                                <option value="enrollment">enrollment</option>
                                <option value="payment">payment</option>
                                <option value="student_session">student_session</option>
                                <option value="learner">learner</option>
                                <option value="batch_enrollment">batch_enrollment</option>
                                <option value="institute_learner">institute_learner</option>
                                <option value="sub_org_member">sub_org_member</option>
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">WHERE Clause (JSON)</Label>
                            <textarea
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                                rows={3}
                                value={
                                    typeof data.config.where === 'string'
                                        ? data.config.where
                                        : JSON.stringify(data.config.where ?? { id: "#ctx['recordId']" }, null, 2)
                                }
                                onChange={(e) => {
                                    try {
                                        handleConfigChange('where', JSON.parse(e.target.value));
                                    } catch {
                                        handleConfigChange('where', e.target.value);
                                    }
                                }}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">SET Clause (JSON)</Label>
                            <textarea
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                                rows={3}
                                value={
                                    typeof data.config.set === 'string'
                                        ? data.config.set
                                        : JSON.stringify(data.config.set ?? { status: 'ACTIVE' }, null, 2)
                                }
                                onChange={(e) => {
                                    try {
                                        handleConfigChange('set', JSON.parse(e.target.value));
                                    } catch {
                                        handleConfigChange('set', e.target.value);
                                    }
                                }}
                            />
                        </div>
                    </>
                )}

                {/* Send Push Notification node config */}
                {data.nodeType === 'SEND_PUSH_NOTIFICATION' && (
                    <>
                        <div>
                            <Label className="text-xs">Title</Label>
                            <Input
                                value={(data.config.title as string) ?? ''}
                                onChange={(e) => handleConfigChange('title', e.target.value)}
                                className="mt-1"
                                placeholder="New assignment posted!"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Body</Label>
                            <textarea
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                rows={2}
                                value={(data.config.body as string) ?? ''}
                                onChange={(e) => handleConfigChange('body', e.target.value)}
                                placeholder="Check out the new assignment in your course"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Recipient Token Expression (SpEL)</Label>
                            <Input
                                value={(data.config.recipientTokenExpression as string) ?? ''}
                                onChange={(e) => handleConfigChange('recipientTokenExpression', e.target.value)}
                                className="mt-1"
                                placeholder="#ctx['fcmTokens']"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Data Payload (JSON, optional)</Label>
                            <textarea
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                                rows={3}
                                value={
                                    typeof data.config.data === 'string'
                                        ? data.config.data
                                        : JSON.stringify(data.config.data ?? {}, null, 2)
                                }
                                onChange={(e) => {
                                    try {
                                        handleConfigChange('data', JSON.parse(e.target.value));
                                    } catch {
                                        handleConfigChange('data', e.target.value);
                                    }
                                }}
                            />
                        </div>
                    </>
                )}

                {/* Generic JSON config for other types */}
                {![
                    'TRIGGER',
                    'SEND_EMAIL',
                    'SEND_WHATSAPP',
                    'HTTP_REQUEST',
                    'QUERY',
                    'DELAY',
                    'FILTER',
                    'AGGREGATE',
                    'CONDITION',
                    'LOOP',
                    'MERGE',
                    'SCHEDULE_TASK',
                    'UPDATE_RECORD',
                    'SEND_PUSH_NOTIFICATION',
                ].includes(data.nodeType) && (
                    <div>
                        <Label className="text-xs">
                            Configuration (JSON)
                        </Label>
                        <textarea
                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                            rows={6}
                            value={JSON.stringify(data.config, null, 2)}
                            onChange={(e) => {
                                try {
                                    const parsed = JSON.parse(e.target.value);
                                    updateNodeConfig(
                                        selectedNode.id,
                                        parsed
                                    );
                                } catch {
                                    // Invalid JSON, ignore
                                }
                            }}
                        />
                    </div>
                )}

                <div className="mt-4 border-t pt-4">
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                            removeNode(selectedNode.id);
                            selectNode(null);
                        }}
                        className="w-full gap-2"
                    >
                        <Trash size={14} />
                        Delete Node
                    </Button>
                </div>
            </div>
        </div>
    );
}
