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
    Plus,
    Trash,
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

type OutputDataPoint = {
    fieldName?: string;
    value?: unknown;
    compute?: string;
    [key: string]: unknown;
};

/**
 * What the simple (non-developer) view can edit on a node: plain-text settings
 * rows and/or literal message variables. Nodes with neither are hidden there.
 */
function normalEditableSections(configText: string): { settings: boolean; message: boolean } {
    try {
        const p: unknown = JSON.parse(configText);
        if (!p || typeof p !== 'object' || Array.isArray(p)) {
            return { settings: false, message: false };
        }
        const cfg = p as Record<string, unknown>;
        const points = Array.isArray(cfg.outputDataPoints)
            ? (cfg.outputDataPoints as OutputDataPoint[])
            : [];
        const settings = points.some(
            (row) =>
                row.compute === undefined &&
                (typeof row.value === 'string' || isNestedStringMap(row.value))
        );
        const vars =
            cfg.templateVars && typeof cfg.templateVars === 'object' && !Array.isArray(cfg.templateVars)
                ? (cfg.templateVars as Record<string, string>)
                : null;
        const message =
            !!vars && Object.values(vars).some((v) => !String(v ?? '').trim().startsWith('#'));
        return { settings, message };
    } catch {
        return { settings: false, message: false };
    }
}

/** True for a two-level map of strings: { day1: { "05:30": "url", ... }, ... } */
function isNestedStringMap(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const outer = Object.values(value as Record<string, unknown>);
    if (outer.length === 0) return false;
    return outer.every(
        (inner) =>
            inner &&
            typeof inner === 'object' &&
            !Array.isArray(inner) &&
            Object.values(inner as Record<string, unknown>).every((v) => typeof v === 'string')
    );
}

/**
 * Grid editor for a two-level string map (e.g. the session-link schedule:
 * day 1–14 sections, each with slot → link inputs). Empty cells mean
 * "use the default link" — the workflow falls back server-side.
 */
function NestedMapGridEditor({
    label,
    grid,
    onChange,
}: {
    label: string;
    grid: Record<string, Record<string, string>>;
    onChange: (next: Record<string, Record<string, string>>) => void;
}) {
    const outerKeys = Object.keys(grid).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
    );
    return (
        <div className="rounded-md border border-neutral-200 bg-white p-2">
            <p className="mb-1 text-xs font-medium text-neutral-600">
                {label}
                <span className="ml-1.5 text-caption font-normal text-neutral-400">
                    empty = use the default link
                </span>
            </p>
            <div className="space-y-1">
                {outerKeys.map((outerKey) => {
                    const inner = grid[outerKey] ?? {};
                    const filled = Object.values(inner).filter(
                        (v) => v && v.trim().length > 0
                    ).length;
                    return (
                        <details key={outerKey} className="rounded border border-neutral-100">
                            <summary className="cursor-pointer px-2 py-1 text-xs text-neutral-600">
                                {outerKey}
                                <span className="ml-2 text-caption text-neutral-400">
                                    {filled > 0 ? `${filled} link(s) set` : 'using default'}
                                </span>
                            </summary>
                            <div className="space-y-1 p-2">
                                {Object.keys(inner).map((slot) => (
                                    <div key={slot} className="flex items-center gap-2">
                                        <span className="w-14 shrink-0 text-right font-mono text-xs text-neutral-500">
                                            {slot}
                                        </span>
                                        <Input
                                            value={inner[slot] ?? ''}
                                            onChange={(e) =>
                                                onChange({
                                                    ...grid,
                                                    [outerKey]: {
                                                        ...inner,
                                                        [slot]: e.target.value,
                                                    },
                                                })
                                            }
                                            placeholder="default link"
                                            spellCheck={false}
                                            className="h-8 flex-1 text-xs"
                                        />
                                    </div>
                                ))}
                            </div>
                        </details>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Friendly editor for a node's `outputDataPoints` (the workflow's "settings" —
 * template text, links, audience lists). Reads and writes the SAME config text
 * the raw JSON editor below shows, so both stay in sync and the normal
 * validate/save flow applies. Rows with `value` are plain text; rows with
 * `compute` are SpEL expressions (marked, still editable).
 */
function OutputDataPointsEditor({
    configText,
    onChange,
    devMode,
}: {
    configText: string;
    onChange: (next: string) => void;
    devMode: boolean;
}) {
    let parsed: Record<string, unknown> | null = null;
    try {
        const p: unknown = JSON.parse(configText);
        if (p && typeof p === 'object' && !Array.isArray(p)) {
            parsed = p as Record<string, unknown>;
        }
    } catch {
        // Invalid JSON — the raw editor is already showing the error; hide this panel.
    }
    const points = parsed && Array.isArray(parsed.outputDataPoints)
        ? (parsed.outputDataPoints as OutputDataPoint[])
        : null;
    if (!parsed || !points) return null;

    const write = (next: OutputDataPoint[]) =>
        onChange(JSON.stringify({ ...parsed, outputDataPoints: next }, null, 2));
    const updateRow = (index: number, patch: Partial<OutputDataPoint>) =>
        write(points.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    const removeRow = (index: number) => write(points.filter((_, i) => i !== index));
    const toggleMode = (index: number) => {
        const row = points[index];
        if (!row) return;
        const { value, compute, ...rest } = row;
        write(
            points.map((p, i) =>
                i === index
                    ? compute !== undefined
                        ? { ...rest, value: compute }
                        : { ...rest, compute: typeof value === 'string' ? value : '' }
                    : p
            )
        );
    };

    const renderRow = (point: OutputDataPoint, index: number) => {
        const isCompute = point.compute !== undefined;
        // Two-level string maps (e.g. a day → slot → link schedule) get a grid
        // editor; other structured values point to the raw JSON editor.
        if (!isCompute && isNestedStringMap(point.value)) {
            return (
                <NestedMapGridEditor
                    key={index}
                    label={point.fieldName ?? 'schedule'}
                    grid={point.value as Record<string, Record<string, string>>}
                    onChange={(next) => updateRow(index, { value: next })}
                />
            );
        }
        if (!isCompute && point.value !== undefined && typeof point.value !== 'string') {
            // Other structured values: dev-only pointer to the raw editor.
            if (!devMode) return null;
            return (
                <div key={index} className="flex items-center gap-2">
                    <Input
                        value={point.fieldName ?? ''}
                        readOnly
                        className="h-8 w-44 shrink-0 bg-neutral-100 font-mono text-xs"
                    />
                    <span className="text-caption text-neutral-400">
                        structured value — edit in config_json below
                    </span>
                </div>
            );
        }
        const text = isCompute ? (point.compute ?? '') : ((point.value as string | undefined) ?? '');
        return (
            <div key={index} className="flex items-start gap-2">
                {devMode ? (
                    <Input
                        value={point.fieldName ?? ''}
                        onChange={(e) => updateRow(index, { fieldName: e.target.value })}
                        placeholder="fieldName"
                        spellCheck={false}
                        className="h-8 w-44 shrink-0 font-mono text-xs"
                    />
                ) : (
                    <span className="mt-2 w-44 shrink-0 truncate text-right text-xs text-neutral-500">
                        {point.fieldName}
                    </span>
                )}
                <Textarea
                    value={text}
                    onChange={(e) =>
                        updateRow(
                            index,
                            isCompute ? { compute: e.target.value } : { value: e.target.value }
                        )
                    }
                    spellCheck={false}
                    rows={Math.min(6, Math.max(1, Math.ceil(text.length / 80)))}
                    className={`min-h-8 flex-1 text-xs ${devMode ? 'font-mono' : ''}`}
                />
                {devMode && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 px-2 text-caption"
                        onClick={() => toggleMode(index)}
                        title={
                            isCompute
                                ? 'SpEL expression — click to treat as plain text'
                                : 'Plain text — click to treat as SpEL expression'
                        }
                    >
                        {isCompute ? 'SpEL' : 'Text'}
                    </Button>
                )}
                {devMode && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 px-2 text-neutral-400 hover:text-red-600"
                        onClick={() => removeRow(index)}
                        title="Remove setting"
                    >
                        <Trash size={14} />
                    </Button>
                )}
            </div>
        );
    };

    // Editable text rows front and center; formula (SpEL) rows folded away so
    // non-technical admins only see what's safe to change.
    const textEntries = points
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.compute === undefined);
    const formulaEntries = points
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.compute !== undefined);

    // In the simple view, hide the panel entirely when there is nothing a
    // non-technical admin can safely change here.
    const normalEditable = textEntries.filter(
        ({ p }) => typeof p.value === 'string' || isNestedStringMap(p.value)
    );
    if (!devMode && normalEditable.length === 0) return null;

    return (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <div className="mb-2 flex items-center justify-between">
                <Label className="text-xs text-neutral-600">
                    Workflow settings
                    <span className="ml-1.5 text-caption text-neutral-400">
                        template text, links &amp; audience values
                    </span>
                </Label>
                {devMode && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 text-caption text-neutral-500"
                        onClick={() => write([...points, { fieldName: '', value: '' }])}
                    >
                        <Plus size={12} /> Add setting
                    </Button>
                )}
            </div>
            <div className="space-y-2">
                {devMode && textEntries.length === 0 && (
                    <p className="text-caption text-neutral-400">
                        No editable text settings on this node.
                    </p>
                )}
                {textEntries.map(({ p, i }) => renderRow(p, i))}
            </div>
            {devMode && formulaEntries.length > 0 && (
                <details className="mt-2">
                    <summary className="cursor-pointer text-caption text-neutral-400">
                        Advanced formulas ({formulaEntries.length}) — edit only if you know SpEL
                    </summary>
                    <div className="mt-2 space-y-2">
                        {formulaEntries.map(({ p, i }) => renderRow(p, i))}
                    </div>
                </details>
            )}
        </div>
    );
}

/**
 * Friendly editor for a send node's message: template name + per-variable rows
 * ({{1}}, {{2}}, ...). Plain-text variables (a day's message line) are editable
 * up front; values starting with '#' are SpEL formulas and live in the advanced
 * fold. Writes into the same config text as the raw JSON editor.
 */
function TemplateVarsEditor({
    configText,
    onChange,
    devMode,
}: {
    configText: string;
    onChange: (next: string) => void;
    devMode: boolean;
}) {
    let parsed: Record<string, unknown> | null = null;
    try {
        const p: unknown = JSON.parse(configText);
        if (p && typeof p === 'object' && !Array.isArray(p)) {
            parsed = p as Record<string, unknown>;
        }
    } catch {
        // Invalid JSON — the raw editor is already showing the error; hide this panel.
    }
    const vars =
        parsed &&
        parsed.templateVars &&
        typeof parsed.templateVars === 'object' &&
        !Array.isArray(parsed.templateVars)
            ? (parsed.templateVars as Record<string, string>)
            : null;
    if (!parsed || !vars) return null;

    const cfg = parsed;
    const writeVar = (key: string, value: string) =>
        onChange(
            JSON.stringify({ ...cfg, templateVars: { ...vars, [key]: value } }, null, 2)
        );
    const writeField = (field: string, value: string) =>
        onChange(JSON.stringify({ ...cfg, [field]: value }, null, 2));

    const entries = Object.entries(vars).sort(([a], [b]) =>
        a.localeCompare(b, undefined, { numeric: true })
    );
    const textVars = entries.filter(([, v]) => !String(v ?? '').trim().startsWith('#'));
    const formulaVars = entries.filter(([, v]) => String(v ?? '').trim().startsWith('#'));

    if (!devMode && textVars.length === 0) return null;

    const renderVar = ([key, value]: [string, string]) => (
        <div key={key} className="flex items-start gap-2">
            <span className="mt-1.5 w-12 shrink-0 text-right font-mono text-xs text-neutral-500">
                {'{{'}
                {key}
                {'}}'}
            </span>
            <Textarea
                value={value ?? ''}
                onChange={(e) => writeVar(key, e.target.value)}
                spellCheck={false}
                rows={Math.min(6, Math.max(1, Math.ceil(String(value ?? '').length / 80)))}
                className="min-h-8 flex-1 text-xs"
            />
        </div>
    );

    return (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <Label className="mb-2 block text-xs text-neutral-600">
                Message content
                <span className="ml-1.5 text-caption text-neutral-400">
                    what this node sends — edit the text freely
                </span>
            </Label>
            {typeof cfg.templateName === 'string' && (
                <div className="mb-2 flex items-center gap-2">
                    <span className="w-12 shrink-0 text-right text-caption text-neutral-500">
                        Template
                    </span>
                    {devMode ? (
                        <Input
                            value={cfg.templateName}
                            onChange={(e) => writeField('templateName', e.target.value)}
                            spellCheck={false}
                            className="h-8 flex-1 font-mono text-xs"
                        />
                    ) : (
                        <span className="text-xs text-neutral-600">{cfg.templateName}</span>
                    )}
                </div>
            )}
            <div className="space-y-2">{textVars.map(renderVar)}</div>
            {devMode && formulaVars.length > 0 && (
                <details className="mt-2">
                    <summary className="cursor-pointer text-caption text-neutral-400">
                        Auto-filled variables ({formulaVars.length}) — name, links, dates
                    </summary>
                    <div className="mt-2 space-y-2">{formulaVars.map(renderVar)}</div>
                </details>
            )}
        </div>
    );
}

function NodeConfigEditorCard({
    workflowId,
    node,
    devMode,
}: {
    workflowId: string;
    node: WorkflowRawNode;
    devMode: boolean;
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

    // Simple view: only show nodes a non-technical admin can act on.
    const editable = normalEditableSections(configText);
    if (!devMode && !editable.settings && !editable.message) return null;

    return (
        <div className="rounded-lg border border-neutral-200 bg-white">
            {/* Card header */}
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500">
                    {node.node_order}
                </span>
                <span className="text-lg">{nodeMeta?.icon ?? '⚙️'}</span>
                <span className="font-medium text-neutral-800">{node.node_name}</span>
                {devMode && (
                    <Badge variant="outline" className="text-[10px] font-medium text-neutral-600">
                        {nodeMeta?.label ?? node.node_type}
                    </Badge>
                )}
                {devMode && isStart && (
                    <Badge className="bg-green-100 text-[10px] text-green-700 hover:bg-green-100">Start</Badge>
                )}
                {devMode && isEnd && (
                    <Badge className="bg-neutral-100 text-[10px] text-neutral-600 hover:bg-neutral-100">End</Badge>
                )}
                {devMode && (
                    <code className="ml-auto hidden text-[10px] text-neutral-400 sm:block">
                        {node.node_template_id}
                    </code>
                )}
            </div>

            {/* Card body */}
            <div className="space-y-4 p-4">
                {/* Node metadata row */}
                <div className={devMode ? 'grid grid-cols-1 gap-3 sm:grid-cols-3' : 'hidden'}>
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
                <div className={devMode ? 'flex flex-wrap items-center gap-6' : 'hidden'}>
                    <label className="flex cursor-pointer items-center gap-2">
                        <Switch checked={isStart} onCheckedChange={setIsStart} />
                        <span className="text-xs text-neutral-600">Start node</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                        <Switch checked={isEnd} onCheckedChange={setIsEnd} />
                        <span className="text-xs text-neutral-600">End node</span>
                    </label>
                </div>

                {/* Friendly settings editors — each shows only when the config has its section */}
                <OutputDataPointsEditor configText={configText} onChange={setConfigText} devMode={devMode} />
                <TemplateVarsEditor configText={configText} onChange={setConfigText} devMode={devMode} />

                {/* config_json editor */}
                <div className={devMode ? '' : 'hidden'}>
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
                <div className={devMode ? '' : 'hidden'}>
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
    // Simple view by default; the developer toggle persists across visits.
    const [devMode, setDevMode] = useState(
        () => localStorage.getItem('workflow-config-dev-mode') === 'true'
    );
    const toggleDevMode = () => {
        const next = !devMode;
        setDevMode(next);
        localStorage.setItem('workflow-config-dev-mode', String(next));
    };

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
            {/* Intro / guidance + view toggle */}
            <div className="flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3">
                <Info size={16} weight="fill" className="mt-0.5 shrink-0 text-primary-500" />
                <div className="flex-1 text-xs text-primary-600">
                    {devMode ? (
                        <>
                            <p className="font-medium">Developer view — full node configuration</p>
                            <p className="mt-0.5 text-primary-500">
                                Edit each node&apos;s raw <code>config_json</code> (including its{' '}
                                <code>routing</code>) in place. Changes are validated and saved directly
                                to the node template — the running workflow picks them up on its next
                                execution.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="font-medium">Workflow settings</p>
                            <p className="mt-0.5 text-primary-500">
                                Edit your messages, links and settings below, then save each card.
                                Changes apply automatically from the workflow&apos;s next run.
                            </p>
                        </>
                    )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={toggleDevMode}
                >
                    <BracketsCurly size={14} />
                    {devMode ? 'Simple view' : 'Developer view'}
                </Button>
            </div>

            {data.nodes.map((node) => (
                <NodeConfigEditorCard
                    key={node.node_template_id}
                    workflowId={workflowId}
                    node={node}
                    devMode={devMode}
                />
            ))}
        </div>
    );
}
