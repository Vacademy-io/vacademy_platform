import { useEffect } from 'react';
import { useWorkflowBuilderStore } from '../-stores/workflow-builder-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash, X, Warning } from '@phosphor-icons/react';
import { WORKFLOW_NODE_TYPES } from '@/types/workflow/workflow-types';
import { getNodeIssues } from './workflow-custom-node';
import { VariablePicker } from './variable-picker';
import { ConditionBuilder } from './condition-builder';
import { AggregateBuilder } from './aggregate-builder';
import { KeyValueBuilder } from './key-value-builder';
import { EventEntityPicker } from './event-entity-picker';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import {
    getQueryKeysQuery,
    getTriggerEventsCatalogQuery,
    getTemplatesByTypeQuery,
} from '@/services/workflow-service';

/** Handles auto-fill of system params and smart input for required query params */
function QueryRequiredParams({ params, config, onConfigChange, nodeId, instituteId, edges, nodes, selectedNodeId }: {
    params: string[];
    config: Record<string, unknown>;
    onConfigChange: (key: string, value: unknown) => void;
    nodeId: string;
    instituteId: string;
    edges: Array<{ source: string; target: string }>;
    nodes: Array<{ id: string; data: Record<string, unknown> }>;
    selectedNodeId: string;
}) {
    // Auto-fill instituteId on mount
    useEffect(() => {
        if (params.includes('instituteId') && !config['instituteId']) {
            onConfigChange('instituteId', "#ctx['instituteId']");
        }
    }, [params, config, onConfigChange]);

    if (params.length === 0) return null;

    // Check if this node has upstream connections
    const hasUpstream = edges.some((e) => e.target === selectedNodeId);

    // Entity type map for ID params
    const entityTypeMap: Record<string, string> = {
        audienceId: 'AUDIENCE',
        batchId: 'PACKAGE_SESSION',
        liveSessionId: 'LIVE_SESSION',
        inviteId: 'ENROLL_INVITE',
    };

    return (
        <div className="space-y-2 border-t pt-2 mt-2">
            <Label className="text-[10px] uppercase text-gray-400">Required Parameters</Label>
            {params.map((param) => {
                const isSystemParam = param === 'instituteId';
                const entityType = entityTypeMap[param];

                return (
                    <div key={param}>
                        <Label className="text-xs">{param}</Label>
                        {isSystemParam ? (
                            <div className="mt-1">
                                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                                    Auto-filled from workflow context
                                </div>
                            </div>
                        ) : entityType ? (
                            <div className="mt-1">
                                <EventEntityPicker
                                    eventAppliedType={entityType}
                                    value={(config[param] as string) || undefined}
                                    onChange={(id) => onConfigChange(param, id ?? '')}
                                    instituteId={instituteId}
                                />
                            </div>
                        ) : hasUpstream ? (
                            <VariablePicker
                                value={(config[param] as string) ?? ''}
                                onChange={(v) => onConfigChange(param, v)}
                                placeholder={`Pick or type value for ${param}...`}
                                nodeId={nodeId}
                            />
                        ) : (
                            <Input
                                value={(config[param] as string) ?? ''}
                                onChange={(e) => onConfigChange(param, e.target.value)}
                                className="mt-1"
                                placeholder={`Enter ${param}...`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export function NodeConfigPanel() {
    const selectedNodeId = useWorkflowBuilderStore((s) => s.selectedNodeId);
    const nodes = useWorkflowBuilderStore((s) => s.nodes);
    const edges = useWorkflowBuilderStore((s) => s.edges);
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
    const { data: emailTemplatesUpper } = useQuery(getTemplatesByTypeQuery(instituteId, 'EMAIL'));
    const { data: emailTemplatesLower } = useQuery(getTemplatesByTypeQuery(instituteId, 'email'));
    const emailTemplates = [...(emailTemplatesUpper ?? []), ...(emailTemplatesLower ?? [])];
    const { data: whatsappTemplatesUpper } = useQuery(getTemplatesByTypeQuery(instituteId, 'WHATSAPP'));
    const { data: whatsappTemplatesLower } = useQuery(getTemplatesByTypeQuery(instituteId, 'whatsapp'));
    const whatsappTemplates = [...(whatsappTemplatesUpper ?? []), ...(whatsappTemplatesLower ?? [])];

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
                {/* Show validation issues */}
                {(() => {
                    const issues = getNodeIssues(data.nodeType, data.config ?? {});
                    return issues.length > 0 ? (
                        <div className="rounded-lg border border-orange-200 bg-orange-50 p-2.5 space-y-1">
                            {issues.map((issue, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs text-orange-700">
                                    <Warning size={12} weight="fill" className="shrink-0" />
                                    {issue}
                                </div>
                            ))}
                        </div>
                    ) : null;
                })()}

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

                {/* Email node config — smart UI, no SpEL needed for common cases */}
                {data.nodeType === 'SEND_EMAIL' && (() => {
                    // Auto-detect available data sources from upstream nodes
                    const upstreamNodes = nodes.filter((n) => {
                        // Find nodes that have an edge pointing to this node
                        return edges.some((e) => e.target === selectedNode.id && e.source === n.id);
                    });

                    // Build data source options based on upstream node types
                    const dataSources: Array<{ label: string; value: string; description: string }> = [];

                    for (const upstream of upstreamNodes) {
                        const uType = upstream.data?.nodeType;
                        const uConfig = upstream.data?.config as Record<string, unknown> | undefined;

                        if (uType === 'TRIGGER') {
                            dataSources.push(
                                { label: 'Respondent emails (from trigger)', value: "#ctx['respondentEmailRequests']", description: 'Pre-built email with to/subject/body from the form submission' },
                                { label: 'Admin emails (from trigger)', value: "#ctx['adminEmailRequests']", description: 'Email notifications for admins' },
                            );
                        }
                        if (uType === 'QUERY') {
                            const queryKey = uConfig?.prebuiltKey as string;
                            if (queryKey === 'fetch_audience_responses_filtered') {
                                dataSources.push({ label: 'Audience leads (from query)', value: "#ctx['leads']", description: 'List of leads with custom field data' });
                            } else if (queryKey === 'fetch_batch_attendance_report') {
                                dataSources.push({ label: 'Students (from attendance query)', value: "#ctx['students']", description: 'List of students with attendance & engagement data' });
                            } else if (queryKey === 'fetch_ssigm_by_package' || queryKey === 'getSSIGMByStatusAndPackageSessionIds') {
                                dataSources.push({ label: 'Enrolled students (from query)', value: "#ctx['ssigm']", description: 'List of enrolled students' });
                            } else if (queryKey) {
                                dataSources.push({ label: `Query results (${queryKey})`, value: "#ctx['queryResult']", description: 'Results from the query node' });
                            }
                        }
                    }

                    // Always offer manual entry as fallback
                    const currentOn = (data.config.on as string) ?? '';

                    return (
                        <>
                            {/* Send to — smart dropdown */}
                            <div>
                                <Label className="text-xs">Send emails to</Label>
                                {dataSources.length > 0 ? (
                                    <>
                                        <select
                                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={currentOn}
                                            onChange={(e) => {
                                                // Set both on AND forEach in a single update to avoid race condition
                                                updateNodeConfig(selectedNode.id, {
                                                    ...data.config,
                                                    on: e.target.value,
                                                    forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
                                                });
                                            }}
                                        >
                                            <option value="">Select data source...</option>
                                            {dataSources.map((ds) => (
                                                <option key={ds.value} value={ds.value}>{ds.label}</option>
                                            ))}
                                        </select>
                                        {/* Show description of selected source */}
                                        {currentOn && (() => {
                                            const selected = dataSources.find((ds) => ds.value === currentOn);
                                            return selected ? (
                                                <p className="mt-1 text-[10px] text-gray-400">{selected.description}</p>
                                            ) : (
                                                <p className="mt-1 text-[10px] text-gray-400 font-mono">{currentOn}</p>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <>
                                        <p className="mt-1 text-[10px] text-gray-400 mb-1.5">
                                            Connect a Trigger or Query node upstream to auto-detect data sources.
                                        </p>
                                        <VariablePicker
                                            value={currentOn}
                                            onChange={(v) => {
                                                updateNodeConfig(selectedNode.id, {
                                                    ...data.config,
                                                    on: v,
                                                    forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
                                                });
                                            }}
                                            placeholder="Pick a list of recipients..."
                                            nodeId={selectedNode.id}
                                        />
                                    </>
                                )}
                            </div>

                            {/* Email template */}
                            <div>
                                <Label className="text-xs">Email Template <span className="text-gray-300 text-[10px]">(optional — skip to use pre-built email from data source)</span></Label>
                                <select
                                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={(data.config.templateName as string) ?? ''}
                                    onChange={(e) => {
                                        const templateName = e.target.value;
                                        const tmpl = emailTemplates?.find((t) => t.name === templateName);
                                        let templateParams = null;
                                        if (tmpl?.dynamic_parameters) {
                                            try { templateParams = JSON.parse(tmpl.dynamic_parameters); } catch { /* ignore */ }
                                        }
                                        updateNodeConfig(selectedNode.id, {
                                            ...data.config,
                                            templateName,
                                            _templateParams: templateParams,
                                        });
                                    }}
                                >
                                    <option value="">No template (use data source's subject/body)</option>
                                    {emailTemplates?.map((t) => (
                                        <option key={t.id} value={t.name}>
                                            {t.name} {t.subject ? `— ${t.subject}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Recipient email field — for choosing which email to send to */}
                            <div>
                                <Label className="text-xs">Send to field <span className="text-gray-300 text-[10px]">(which email field from each item)</span></Label>
                                <select
                                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={(data.config.recipientField as string) ?? ''}
                                    onChange={(e) => handleConfigChange('recipientField', e.target.value)}
                                >
                                    <option value="">Auto-detect (to, email)</option>
                                    <option value="email">Student Email</option>
                                    <option value="parentsEmail">Father/Parent Email</option>
                                    <option value="guardianEmail">Guardian Email</option>
                                    <option value="motherEmail">Mother Email</option>
                                    <option value="to">To (pre-built recipient)</option>
                                </select>
                            </div>

                            {/* Template variables — only shown when a template is selected */}
                            {data.config._templateParams && typeof data.config._templateParams === 'object' && (
                                <div className="space-y-2 border-t pt-2 mt-2">
                                    <Label className="text-[10px] uppercase text-gray-400">Template Variables</Label>
                                    <p className="text-[10px] text-gray-400">
                                        Map each template variable to a field from the data source. Each item in the list has fields you can reference.
                                    </p>
                                    {Object.entries(data.config._templateParams as Record<string, string>).map(([key, label]) => (
                                        <div key={key}>
                                            <Label className="text-xs">{label || key}</Label>
                                            <Input
                                                value={((data.config.templateVars as Record<string, string>)?.[key]) ?? ''}
                                                onChange={(e) => {
                                                    const vars = { ...(data.config.templateVars as Record<string, string> ?? {}), [key]: e.target.value };
                                                    handleConfigChange('templateVars', vars);
                                                }}
                                                className="mt-1"
                                                placeholder={`e.g. fullName, email, attendancePercentage`}
                                            />
                                            <p className="text-[10px] text-gray-300">
                                                Field name from each item in the data source
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    );
                })()}

                {/* WhatsApp node config — upgraded with template dropdown + dynamic params */}
                {data.nodeType === 'SEND_WHATSAPP' && (
                    <>
                        <div>
                            <Label className="text-xs">WhatsApp Template</Label>
                            <select
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={(data.config.templateName as string) ?? ''}
                                onChange={(e) => {
                                    const templateName = e.target.value;
                                    const tmpl = whatsappTemplates?.find((t) => t.name === templateName);
                                    let templateParams = null;
                                    if (tmpl?.dynamic_parameters) {
                                        try { templateParams = JSON.parse(tmpl.dynamic_parameters); } catch { /* ignore */ }
                                    }
                                    updateNodeConfig(selectedNode.id, {
                                        ...data.config,
                                        templateName,
                                        forEach: { operation: 'SEND_WHATSAPP', eval: "#ctx['item']" },
                                        _templateParams: templateParams,
                                    });
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
                                onChange={(v) => {
                                    updateNodeConfig(selectedNode.id, {
                                        ...data.config,
                                        on: v,
                                        forEach: { operation: 'SEND_WHATSAPP', eval: "#ctx['item']" },
                                    });
                                }}
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
                        <QueryRequiredParams
                            params={selectedQueryKey?.required_params ?? []}
                            config={data.config}
                            onConfigChange={handleConfigChange}
                            nodeId={selectedNode.id}
                            instituteId={instituteId}
                            edges={edges}
                            nodes={nodes}
                            selectedNodeId={selectedNode.id}
                        />
                        {/* Optional params from catalog */}
                        {selectedQueryKey?.optional_params && selectedQueryKey.optional_params.length > 0 && (
                            <div className="space-y-2 border-t pt-2 mt-2">
                                <Label className="text-[10px] uppercase text-gray-400">Optional Filters</Label>
                                {selectedQueryKey.optional_params.map((param) => {
                                    // Map param names to EventEntityPicker types
                                    const entityTypeMap: Record<string, string> = {
                                        audienceId: 'AUDIENCE',
                                        batchId: 'PACKAGE_SESSION',
                                        liveSessionId: 'LIVE_SESSION',
                                        inviteId: 'ENROLL_INVITE',
                                    };
                                    const entityType = entityTypeMap[param];

                                    return (
                                        <div key={param}>
                                            <Label className="text-xs text-gray-500">{param} <span className="text-gray-300">(optional)</span></Label>
                                            {entityType ? (
                                                <div className="mt-1">
                                                    <EventEntityPicker
                                                        eventAppliedType={entityType}
                                                        value={(data.config[param] as string) || undefined}
                                                        onChange={(id) => handleConfigChange(param, id ?? '')}
                                                        instituteId={instituteId}
                                                    />
                                                </div>
                                            ) : (
                                                <Input
                                                    value={(data.config[param] as string) ?? ''}
                                                    onChange={(e) => handleConfigChange(param, e.target.value)}
                                                    className="mt-1"
                                                    placeholder={
                                                        param === 'daysAgo' || param === 'daysBack' ? 'e.g. 5'
                                                        : param === 'daysUntilExpiry' ? 'e.g. 7'
                                                        : param === 'status' ? 'e.g. ACTIVE'
                                                        : param.includes('Date') ? 'YYYY-MM-DD'
                                                        : `Enter ${param}...`
                                                    }
                                                />
                                            )}
                                        </div>
                                    );
                                })}
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

                {/* Delay node config — saves as config.delay.value / config.delay.unit to match backend */}
                {data.nodeType === 'DELAY' && (() => {
                    const delay = (data.config.delay as { value?: number; unit?: string }) ?? {};
                    // Backward compat: read from flat keys if nested doesn't exist
                    const delayValue = delay.value ?? (data.config.delayValue as number) ?? 5;
                    const delayUnit = delay.unit ?? (data.config.delayUnit as string) ?? 'MINUTES';
                    const updateDelay = (field: string, val: unknown) => {
                        handleConfigChange('delay', { ...delay, value: delayValue, unit: delayUnit, [field]: val });
                    };
                    return (
                        <>
                            <div>
                                <Label className="text-xs">Wait for</Label>
                                <div className="mt-1 flex items-center gap-2">
                                    <Input
                                        type="number"
                                        value={delayValue}
                                        onChange={(e) => updateDelay('value', parseInt(e.target.value) || 0)}
                                        className="w-20"
                                        min={0}
                                    />
                                    <select
                                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={delayUnit}
                                        onChange={(e) => updateDelay('unit', e.target.value)}
                                    >
                                        <option value="SECONDS">Seconds</option>
                                        <option value="MINUTES">Minutes</option>
                                        <option value="HOURS">Hours</option>
                                        <option value="DAYS">Days</option>
                                    </select>
                                </div>
                                {delayUnit === 'DAYS' && delayValue > 0 && (
                                    <p className="mt-1.5 text-[10px] text-primary-500">
                                        Workflow will pause and resume automatically after {delayValue} day{delayValue > 1 ? 's' : ''}.
                                    </p>
                                )}
                            </div>
                        </>
                    );
                })()}

                {/* Filter node config — Visual Condition Builder in item mode */}
                {data.nodeType === 'FILTER' && (
                    <>
                        <div>
                            <Label className="text-xs">Source List</Label>
                            <VariablePicker
                                value={(data.config.source as string) ?? ''}
                                onChange={(v) => handleConfigChange('source', v)}
                                placeholder="Pick a list to filter..."
                                nodeId={selectedNode.id}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Keep items where</Label>
                            <div className="mt-1.5">
                                <ConditionBuilder
                                    value={(data.config.condition as string) ?? ''}
                                    onChange={(v) => handleConfigChange('condition', v)}
                                    nodeId={selectedNode.id}
                                    itemMode
                                />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs">Save filtered list as</Label>
                            <Input
                                value={(data.config.outputKey as string) ?? 'filteredList'}
                                onChange={(e) => handleConfigChange('outputKey', e.target.value)}
                                className="mt-1"
                                placeholder="filteredList"
                            />
                        </div>
                    </>
                )}

                {/* Aggregate node config — Visual Operation Builder */}
                {data.nodeType === 'AGGREGATE' && (
                    <>
                        <div>
                            <Label className="text-xs">Source List</Label>
                            <VariablePicker
                                value={(data.config.source as string) ?? ''}
                                onChange={(v) => handleConfigChange('source', v)}
                                placeholder="Pick a list to aggregate..."
                                nodeId={selectedNode.id}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Operations</Label>
                            <div className="mt-1.5">
                                <AggregateBuilder
                                    value={(data.config.operations as Array<{ type: string; field?: string; outputKey: string }>) ?? []}
                                    onChange={(ops) => handleConfigChange('operations', ops)}
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* Condition (If/Else) node config — Visual Condition Builder */}
                {data.nodeType === 'CONDITION' && (
                    <>
                        <div>
                            <Label className="text-xs">Condition</Label>
                            <div className="mt-1.5">
                                <ConditionBuilder
                                    value={(data.config.condition as string) ?? ''}
                                    onChange={(v) => handleConfigChange('condition', v)}
                                    nodeId={selectedNode.id}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
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

                {/* Update Record node config — Visual Key-Value Builder */}
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
                            <Label className="text-xs">Find records where</Label>
                            <div className="mt-1.5">
                                <KeyValueBuilder
                                    value={(data.config.where as Record<string, string>) ?? {}}
                                    onChange={(kv) => handleConfigChange('where', kv)}
                                    nodeId={selectedNode.id}
                                    keyPlaceholder="column"
                                    valuePlaceholder="match value"
                                />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs">Set values to</Label>
                            <div className="mt-1.5">
                                <KeyValueBuilder
                                    value={(data.config.set as Record<string, string>) ?? {}}
                                    onChange={(kv) => handleConfigChange('set', kv)}
                                    nodeId={selectedNode.id}
                                    keyPlaceholder="column"
                                    valuePlaceholder="new value"
                                />
                            </div>
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
                            <Label className="text-xs">Recipient Tokens</Label>
                            <VariablePicker
                                value={(data.config.recipientTokenExpression as string) ?? ''}
                                onChange={(v) => handleConfigChange('recipientTokenExpression', v)}
                                placeholder="Pick FCM token list..."
                                nodeId={selectedNode.id}
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
