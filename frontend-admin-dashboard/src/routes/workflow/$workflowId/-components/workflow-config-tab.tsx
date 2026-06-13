import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getWorkflowRawQuery,
    updateNodeTemplate,
    WorkflowRawNode,
} from '@/services/workflow-service';
import { WORKFLOW_NODE_TYPES } from '@/types/workflow/workflow-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    FloppyDisk,
    ArrowCounterClockwise,
    CheckCircle,
    Warning,
    BracketsCurly,
    Info,
} from '@phosphor-icons/react';

/** Pretty-print a JSON string; returns the original text if it can't be parsed. */
function formatJson(raw: string | null | undefined): string {
    if (!raw || !raw.trim()) return '';
    try {
        return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
        return raw;
    }
}

/** Validate a JSON string is a JSON object. Empty is allowed (treated as "no value"). */
function jsonObjectError(text: string, { allowEmpty }: { allowEmpty: boolean }): string | null {
    const trimmed = text.trim();
    if (!trimmed) return allowEmpty ? null : 'Cannot be empty';
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch (e) {
        return e instanceof Error ? e.message : 'Invalid JSON';
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return 'Must be a JSON object ({ ... })';
    }
    return null;
}

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'DRAFT'];

function NodeConfigEditorCard({
    workflowId,
    node,
}: {
    workflowId: string;
    node: WorkflowRawNode;
}) {
    const queryClient = useQueryClient();

    // Snapshot string of the server-side node — when it changes (e.g. after a save refetch),
    // we re-sync local edit state to match.
    const snapshot = useMemo(
        () =>
            JSON.stringify([
                node.config_json,
                node.node_name,
                node.node_type,
                node.status,
                node.retry_config,
                node.is_start_node,
                node.is_end_node,
            ]),
        [node]
    );

    const [configText, setConfigText] = useState(() => formatJson(node.config_json));
    const [retryText, setRetryText] = useState(() => formatJson(node.retry_config));
    const [nodeName, setNodeName] = useState(node.node_name ?? '');
    const [nodeType, setNodeType] = useState(node.node_type ?? '');
    const [status, setStatus] = useState(node.status ?? 'ACTIVE');
    const [isStart, setIsStart] = useState(Boolean(node.is_start_node));
    const [isEnd, setIsEnd] = useState(Boolean(node.is_end_node));
    const [savedOk, setSavedOk] = useState(false);

    // Re-sync local state whenever the server node changes.
    useEffect(() => {
        setConfigText(formatJson(node.config_json));
        setRetryText(formatJson(node.retry_config));
        setNodeName(node.node_name ?? '');
        setNodeType(node.node_type ?? '');
        setStatus(node.status ?? 'ACTIVE');
        setIsStart(Boolean(node.is_start_node));
        setIsEnd(Boolean(node.is_end_node));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [snapshot]);

    const configError = jsonObjectError(configText, { allowEmpty: false });
    const retryError = jsonObjectError(retryText, { allowEmpty: true });

    const originalConfig = formatJson(node.config_json);
    const originalRetry = formatJson(node.retry_config);
    const isDirty =
        configText !== originalConfig ||
        retryText !== originalRetry ||
        nodeName !== (node.node_name ?? '') ||
        nodeType !== (node.node_type ?? '') ||
        status !== (node.status ?? 'ACTIVE') ||
        isStart !== Boolean(node.is_start_node) ||
        isEnd !== Boolean(node.is_end_node);

    const mutation = useMutation({
        mutationFn: () =>
            updateNodeTemplate(workflowId, node.node_template_id, {
                config_json: configText,
                node_name: nodeName,
                node_type: nodeType,
                status,
                retry_config: retryText.trim() === '' ? '' : retryText,
                is_start_node: isStart,
                is_end_node: isEnd,
            }),
        onSuccess: async () => {
            setSavedOk(true);
            setTimeout(() => setSavedOk(false), 2500);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['WORKFLOW_RAW', workflowId] }),
                queryClient.invalidateQueries({ queryKey: ['GET_WORKFLOW_DIAGRAM', workflowId] }),
            ]);
        },
    });

    const saveDisabled = !isDirty || !!configError || !!retryError || mutation.isPending;

    const revert = () => {
        setConfigText(originalConfig);
        setRetryText(originalRetry);
        setNodeName(node.node_name ?? '');
        setNodeType(node.node_type ?? '');
        setStatus(node.status ?? 'ACTIVE');
        setIsStart(Boolean(node.is_start_node));
        setIsEnd(Boolean(node.is_end_node));
        mutation.reset();
    };

    const nodeMeta = WORKFLOW_NODE_TYPES.find((t) => t.type === node.node_type);

    return (
        <div className="rounded-lg border border-neutral-200 bg-white">
            {/* Card header */}
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500">
                    {node.node_order}
                </span>
                <span className="text-lg">{nodeMeta?.icon ?? '⚙️'}</span>
                <span className="font-medium text-neutral-800">{node.node_name}</span>
                <Badge variant="outline" className="text-[10px] font-medium text-neutral-600">
                    {nodeMeta?.label ?? node.node_type}
                </Badge>
                {isStart && (
                    <Badge className="bg-green-100 text-[10px] text-green-700 hover:bg-green-100">Start</Badge>
                )}
                {isEnd && (
                    <Badge className="bg-neutral-100 text-[10px] text-neutral-600 hover:bg-neutral-100">End</Badge>
                )}
                <code className="ml-auto hidden text-[10px] text-neutral-400 sm:block">
                    {node.node_template_id}
                </code>
            </div>

            {/* Card body */}
            <div className="space-y-4 p-4">
                {/* Node metadata row */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <Label className="text-xs text-neutral-600">Node name</Label>
                        <Input
                            value={nodeName}
                            onChange={(e) => setNodeName(e.target.value)}
                            className="mt-1"
                            placeholder="Node name"
                        />
                    </div>
                    <div>
                        <Label className="text-xs text-neutral-600">Node type</Label>
                        <select
                            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={nodeType}
                            onChange={(e) => setNodeType(e.target.value)}
                        >
                            {WORKFLOW_NODE_TYPES.map((t) => (
                                <option key={t.type} value={t.type}>
                                    {t.label} ({t.type})
                                </option>
                            ))}
                            {/* Keep an unknown stored type selectable rather than silently dropping it */}
                            {!WORKFLOW_NODE_TYPES.some((t) => t.type === nodeType) && nodeType && (
                                <option value={nodeType}>{nodeType}</option>
                            )}
                        </select>
                    </div>
                    <div>
                        <Label className="text-xs text-neutral-600">Status</Label>
                        <select
                            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                            {!STATUS_OPTIONS.includes(status) && status && (
                                <option value={status}>{status}</option>
                            )}
                        </select>
                    </div>
                </div>

                {/* Start / end toggles */}
                <div className="flex flex-wrap items-center gap-6">
                    <label className="flex cursor-pointer items-center gap-2">
                        <Switch checked={isStart} onCheckedChange={setIsStart} />
                        <span className="text-xs text-neutral-600">Start node</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                        <Switch checked={isEnd} onCheckedChange={setIsEnd} />
                        <span className="text-xs text-neutral-600">End node</span>
                    </label>
                </div>

                {/* config_json editor */}
                <div>
                    <div className="mb-1 flex items-center justify-between">
                        <Label className="text-xs text-neutral-600">
                            config_json
                            <span className="ml-1.5 text-[10px] text-neutral-400">
                                routing &amp; node settings live here
                            </span>
                        </Label>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 gap-1 text-[11px] text-neutral-500"
                            disabled={!!configError}
                            onClick={() => setConfigText(formatJson(configText))}
                            title="Format JSON"
                        >
                            <BracketsCurly size={12} /> Format
                        </Button>
                    </div>
                    <Textarea
                        value={configText}
                        onChange={(e) => setConfigText(e.target.value)}
                        spellCheck={false}
                        className={`min-h-[180px] font-mono text-xs ${
                            configError ? 'border-red-300 focus-visible:ring-red-200' : ''
                        }`}
                    />
                    {configError && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-red-600">
                            <Warning size={12} weight="fill" /> {configError}
                        </p>
                    )}
                </div>

                {/* retry_config editor (optional) */}
                <div>
                    <Label className="text-xs text-neutral-600">
                        retry_config
                        <span className="ml-1.5 text-[10px] text-neutral-400">
                            optional — e.g. {'{"maxRetries":3,"backoffMs":1000}'}
                        </span>
                    </Label>
                    <Textarea
                        value={retryText}
                        onChange={(e) => setRetryText(e.target.value)}
                        spellCheck={false}
                        placeholder="(none)"
                        className={`mt-1 min-h-[64px] font-mono text-xs ${
                            retryError ? 'border-red-300 focus-visible:ring-red-200' : ''
                        }`}
                    />
                    {retryError && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-red-600">
                            <Warning size={12} weight="fill" /> {retryError}
                        </p>
                    )}
                </div>

                {/* Save error */}
                {mutation.isError && (
                    <p className="flex items-center gap-1 text-xs text-red-600">
                        <Warning size={14} weight="fill" />
                        {mutation.error instanceof Error ? mutation.error.message : 'Failed to save'}
                    </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-3">
                    {savedOk && (
                        <span className="mr-auto flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle size={14} weight="fill" /> Saved
                        </span>
                    )}
                    {isDirty && !savedOk && (
                        <span className="mr-auto text-xs text-neutral-400">Unsaved changes</span>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={!isDirty || mutation.isPending}
                        onClick={revert}
                    >
                        <ArrowCounterClockwise size={14} /> Revert
                    </Button>
                    <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={saveDisabled}
                        onClick={() => mutation.mutate()}
                    >
                        <FloppyDisk size={14} />
                        {mutation.isPending ? 'Saving...' : 'Save node'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function WorkflowConfigTab({ workflowId }: { workflowId: string }) {
    const { data, isLoading, error } = useQuery(getWorkflowRawQuery(workflowId));

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12 text-sm text-neutral-400">
                Loading configuration...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
                <p className="text-sm text-red-500">Failed to load configuration</p>
                <p className="text-xs text-neutral-400">
                    {error instanceof Error ? error.message : 'Unknown error'}
                </p>
            </div>
        );
    }

    if (!data || data.nodes.length === 0) {
        return (
            <div className="flex items-center justify-center py-12 text-sm text-neutral-400">
                This workflow has no nodes to configure.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Intro / guidance */}
            <div className="flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3">
                <Info size={16} weight="fill" className="mt-0.5 shrink-0 text-primary-500" />
                <div className="text-xs text-primary-600">
                    <p className="font-medium">Advanced node configuration</p>
                    <p className="mt-0.5 text-primary-500">
                        Edit each node&apos;s raw <code>config_json</code> (including its{' '}
                        <code>routing</code>) in place. Changes are validated and saved directly to the
                        node template — the running workflow picks them up on its next execution. This is
                        the loss-less alternative to the visual editor for complex workflows.
                    </p>
                </div>
            </div>

            {data.nodes.map((node) => (
                <NodeConfigEditorCard key={node.node_template_id} workflowId={workflowId} node={node} />
            ))}
        </div>
    );
}
