import { useEffect, useState } from 'react';
import { Plus, Trash, ArrowRight } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MyDropdown } from '@/components/design-system/dropdown';
import { MyDialog } from '@/components/design-system/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/design-system/multi-select';
import { useLeadCounsellorOptions } from '@/hooks/use-lead-counsellor-options';
import { cn } from '@/lib/utils';
import {
    type IvrMenuDTO,
    type IvrNodeDTO,
    type IvrNodeType,
    IVR_NODE_TYPE_LABELS,
} from '../-services/ivr-admin';

interface IvrMenuEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    instituteId: string;
    /** The menu to edit, or null to create a new one. */
    initialMenu: IvrMenuDTO | null;
    onSave: (menu: IvrMenuDTO) => void;
    saving: boolean;
}

const NODE_TYPE_OPTIONS: { label: string; value: IvrNodeType }[] = (
    Object.keys(IVR_NODE_TYPE_LABELS) as IvrNodeType[]
).map((t) => ({ label: IVR_NODE_TYPE_LABELS[t], value: t }));

const PROMPT_LABEL: Record<IvrNodeType, string> = {
    PLAY: 'Message to play',
    GATHER: 'Menu prompt (e.g. “Press 1 for sales, 2 for support”)',
    DIAL: 'Message before connecting (optional)',
    VOICEMAIL: 'Voicemail greeting',
    HANGUP: 'Goodbye message (optional)',
};

function blankMenu(instituteId: string): IvrMenuDTO {
    return {
        id: null,
        instituteId,
        name: '',
        dialedNumber: '',
        rootNodeId: null,
        enabled: true,
        nodes: [],
    };
}

function newNode(type: IvrNodeType): IvrNodeDTO {
    return {
        id: crypto.randomUUID(),
        nodeType: type,
        label: '',
        promptText: '',
        promptAudioId: null,
        digitMap: {},
        dialTargets: [],
        nextNodeId: null,
        timeoutSeconds: 6,
        maxRetries: 2,
    };
}

function nodeDisplay(node: IvrNodeDTO, index: number): string {
    const name = node.label?.trim() || IVR_NODE_TYPE_LABELS[node.nodeType];
    return `${index + 1}. ${name}`;
}

export function IvrMenuEditor({
    open,
    onOpenChange,
    instituteId,
    initialMenu,
    onSave,
    saving,
}: IvrMenuEditorProps) {
    const [draft, setDraft] = useState<IvrMenuDTO>(() => blankMenu(instituteId));

    // Reset the working copy whenever the dialog opens (new vs edit).
    useEffect(() => {
        if (open) {
            setDraft(
                initialMenu
                    ? JSON.parse(JSON.stringify(initialMenu))
                    : blankMenu(instituteId)
            );
        }
    }, [open, initialMenu, instituteId]);

    const { options: counsellorRaw } = useLeadCounsellorOptions();
    const counsellorOptions = counsellorRaw.map((c) => ({ label: c.full_name, value: c.id }));

    const nodes = draft.nodes;
    const refOptions = nodes.map((n, i) => ({ label: nodeDisplay(n, i), value: n.id }));
    const displayFor = (id?: string | null): string => {
        const idx = nodes.findIndex((n) => n.id === id);
        return idx >= 0 ? nodeDisplay(nodes[idx]!, idx) : '';
    };

    const patchNode = (id: string, patch: Partial<IvrNodeDTO>) =>
        setDraft((d) => ({
            ...d,
            nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
        }));

    const addNode = (type: IvrNodeType) =>
        setDraft((d) => {
            const node = newNode(type);
            return {
                ...d,
                nodes: [...d.nodes, node],
                rootNodeId: d.rootNodeId ?? node.id,
            };
        });

    const removeNode = (id: string) =>
        setDraft((d) => {
            const remaining = d.nodes.filter((n) => n.id !== id);
            return {
                ...d,
                rootNodeId:
                    d.rootNodeId === id ? (remaining[0]?.id ?? null) : d.rootNodeId,
                nodes: remaining.map((n) => ({
                    ...n,
                    nextNodeId: n.nextNodeId === id ? null : n.nextNodeId,
                    digitMap: Object.fromEntries(
                        Object.entries(n.digitMap ?? {}).filter(([, t]) => t !== id)
                    ),
                })),
            };
        });

    const setGatherOption = (
        node: IvrNodeDTO,
        oldDigit: string,
        digit: string,
        target: string
    ) => {
        const next: Record<string, string> = {};
        for (const [d, t] of Object.entries(node.digitMap ?? {})) {
            if (d === oldDigit) continue;
            next[d] = t;
        }
        if (digit.trim()) next[digit.trim()] = target;
        patchNode(node.id, { digitMap: next });
    };

    const handleSave = () => {
        if (!draft.name.trim()) {
            toast.error('Give the menu a name');
            return;
        }
        if (draft.nodes.length === 0) {
            toast.error('Add at least one step');
            return;
        }
        if (!draft.rootNodeId) {
            toast.error('Pick the step the call starts at');
            return;
        }
        const cleaned: IvrMenuDTO = {
            ...draft,
            name: draft.name.trim(),
            dialedNumber: draft.dialedNumber?.trim() ? draft.dialedNumber.trim() : null,
            nodes: draft.nodes.map((n) => ({
                ...n,
                label: n.label?.trim() || null,
                promptText: n.promptText?.trim() || null,
                dialTargets: (n.dialTargets ?? []).map((s) => s.trim()).filter(Boolean),
                digitMap: Object.fromEntries(
                    Object.entries(n.digitMap ?? {}).filter(([d, t]) => d.trim() && t)
                ),
            })),
        };
        onSave(cleaned);
    };

    return (
        <MyDialog
            heading={initialMenu ? 'Edit IVR menu' : 'New IVR menu'}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-3xl"
            footer={
                <>
                    <MyButton buttonType="secondary" scale="medium" onClick={() => onOpenChange(false)}>
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={handleSave}
                        disable={saving}
                    >
                        {saving ? 'Saving…' : 'Save menu'}
                    </MyButton>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                {/* Menu-level fields */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <MyInput
                        label="Menu name"
                        inputType="text"
                        required
                        inputPlaceholder="e.g. Main reception"
                        input={draft.name}
                        onChangeFunction={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                    <MyInput
                        label="Phone number (optional)"
                        inputType="text"
                        inputPlaceholder="Leave blank for default"
                        input={draft.dialedNumber ?? ''}
                        onChangeFunction={(e) =>
                            setDraft((d) => ({ ...d, dialedNumber: e.target.value }))
                        }
                    />
                    <div className="flex flex-col gap-1">
                        <Label className="text-subtitle font-regular">Enabled</Label>
                        <div className="flex h-9 items-center">
                            <Switch
                                checked={draft.enabled ?? true}
                                onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
                            />
                        </div>
                    </div>
                </div>

                <p className="text-caption text-neutral-500">
                    Numbers that aren’t set to a specific menu use the menu left blank (your default).
                </p>

                {/* Start step */}
                {nodes.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <Label className="text-subtitle font-regular">Call starts at</Label>
                        <MyDropdown
                            placeholder="Pick the first step"
                            currentValue={displayFor(draft.rootNodeId)}
                            dropdownList={refOptions}
                            handleChange={(v) => setDraft((d) => ({ ...d, rootNodeId: v }))}
                        />
                    </div>
                )}

                {/* Steps */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-subtitle font-semibold text-neutral-700">Steps</h3>
                        <MyDropdown
                            placeholder="Add step"
                            currentValue=""
                            dropdownList={NODE_TYPE_OPTIONS}
                            handleChange={(v) => addNode(v as IvrNodeType)}
                            className="w-40"
                        />
                    </div>

                    {nodes.length === 0 && (
                        <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-body text-neutral-500">
                            No steps yet. Add a step (e.g. a Menu that asks the caller to press 1 or 2)
                            to start building your call flow.
                        </div>
                    )}

                    {nodes.map((node, index) => (
                        <div
                            key={node.id}
                            className={cn(
                                'flex flex-col gap-3 rounded-lg border p-4',
                                draft.rootNodeId === node.id
                                    ? 'border-primary-300 bg-primary-50'
                                    : 'border-neutral-200'
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-caption font-semibold text-neutral-500">
                                    Step {index + 1}
                                    {draft.rootNodeId === node.id && ' · start'}
                                </span>
                                <MyButton
                                    buttonType="secondary"
                                    layoutVariant="icon"
                                    scale="small"
                                    onClick={() => removeNode(node.id)}
                                >
                                    <Trash className="text-danger-600" />
                                </MyButton>
                            </div>

                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                <div className="flex flex-col gap-1">
                                    <Label className="text-subtitle font-regular">Type</Label>
                                    <MyDropdown
                                        currentValue={IVR_NODE_TYPE_LABELS[node.nodeType]}
                                        dropdownList={NODE_TYPE_OPTIONS}
                                        handleChange={(v) =>
                                            patchNode(node.id, { nodeType: v as IvrNodeType })
                                        }
                                        className="w-56"
                                    />
                                </div>
                                <MyInput
                                    label="Label (optional)"
                                    inputType="text"
                                    inputPlaceholder="e.g. Sales option"
                                    input={node.label ?? ''}
                                    onChangeFunction={(e) =>
                                        patchNode(node.id, { label: e.target.value })
                                    }
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <Label className="text-subtitle font-regular">
                                    {PROMPT_LABEL[node.nodeType]}
                                </Label>
                                <Textarea
                                    value={node.promptText ?? ''}
                                    onChange={(e) =>
                                        patchNode(node.id, { promptText: e.target.value })
                                    }
                                    placeholder="What the caller hears…"
                                    className="min-h-16"
                                />
                            </div>

                            {/* GATHER: digit → step routing */}
                            {node.nodeType === 'GATHER' && (
                                <div className="flex flex-col gap-2">
                                    <Label className="text-subtitle font-regular">Key presses</Label>
                                    {Object.entries(node.digitMap ?? {}).map(([digit, target]) => (
                                        <div
                                            key={digit}
                                            className="flex items-center gap-2"
                                        >
                                            <span className="text-body text-neutral-500">Press</span>
                                            <MyInput
                                                inputType="text"
                                                input={digit}
                                                inputPlaceholder="1"
                                                onChangeFunction={(e) =>
                                                    setGatherOption(
                                                        node,
                                                        digit,
                                                        e.target.value.replace(/[^0-9*#]/g, '').slice(0, 1),
                                                        target
                                                    )
                                                }
                                                className="!w-16"
                                            />
                                            <ArrowRight className="shrink-0 text-neutral-400" />
                                            <MyDropdown
                                                placeholder="Go to step"
                                                currentValue={displayFor(target)}
                                                dropdownList={refOptions.filter(
                                                    (o) => o.value !== node.id
                                                )}
                                                handleChange={(v) =>
                                                    setGatherOption(node, digit, digit, v)
                                                }
                                                className="w-56"
                                            />
                                            <MyButton
                                                buttonType="secondary"
                                                layoutVariant="icon"
                                                scale="small"
                                                onClick={() => {
                                                    const next = { ...(node.digitMap ?? {}) };
                                                    delete next[digit];
                                                    patchNode(node.id, { digitMap: next });
                                                }}
                                            >
                                                <Trash className="text-neutral-400" />
                                            </MyButton>
                                        </div>
                                    ))}
                                    <MyButton
                                        buttonType="text"
                                        scale="small"
                                        onClick={() => {
                                            const used = new Set(Object.keys(node.digitMap ?? {}));
                                            const free =
                                                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].find(
                                                    (d) => !used.has(d)
                                                ) ?? '';
                                            patchNode(node.id, {
                                                digitMap: { ...(node.digitMap ?? {}), [free]: '' },
                                            });
                                        }}
                                    >
                                        <Plus className="mr-1" /> Add key press
                                    </MyButton>
                                </div>
                            )}

                            {/* DIAL: numbers to ring */}
                            {node.nodeType === 'DIAL' && (
                                <div className="flex flex-col gap-2">
                                    <Label className="text-subtitle font-regular">
                                        Numbers to ring
                                    </Label>
                                    {(node.dialTargets ?? []).map((num, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <MyInput
                                                inputType="text"
                                                input={num}
                                                inputPlaceholder="+9198XXXXXXXX"
                                                onChangeFunction={(e) => {
                                                    const next = [...(node.dialTargets ?? [])];
                                                    next[i] = e.target.value;
                                                    patchNode(node.id, { dialTargets: next });
                                                }}
                                            />
                                            <MyButton
                                                buttonType="secondary"
                                                layoutVariant="icon"
                                                scale="small"
                                                onClick={() => {
                                                    const next = [...(node.dialTargets ?? [])];
                                                    next.splice(i, 1);
                                                    patchNode(node.id, { dialTargets: next });
                                                }}
                                            >
                                                <Trash className="text-neutral-400" />
                                            </MyButton>
                                        </div>
                                    ))}
                                    <MyButton
                                        buttonType="text"
                                        scale="small"
                                        onClick={() =>
                                            patchNode(node.id, {
                                                dialTargets: [...(node.dialTargets ?? []), ''],
                                            })
                                        }
                                    >
                                        <Plus className="mr-1" /> Add number
                                    </MyButton>

                                    <Label className="text-subtitle font-regular">
                                        Or ring team members
                                    </Label>
                                    <MultiSelect
                                        options={counsellorOptions}
                                        selected={node.dialUserIds ?? []}
                                        onChange={(ids) => patchNode(node.id, { dialUserIds: ids })}
                                        placeholder="Pick team members to ring"
                                    />
                                </div>
                            )}

                            {/* PLAY: where to go next */}
                            {node.nodeType === 'PLAY' && (
                                <div className="flex flex-col gap-1">
                                    <Label className="text-subtitle font-regular">
                                        After the message, go to
                                    </Label>
                                    <MyDropdown
                                        placeholder="Next step (or hang up)"
                                        currentValue={displayFor(node.nextNodeId)}
                                        dropdownList={refOptions.filter((o) => o.value !== node.id)}
                                        handleChange={(v) => patchNode(node.id, { nextNodeId: v })}
                                        className="w-64"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </MyDialog>
    );
}
