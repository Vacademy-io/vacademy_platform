import { useEffect, useMemo, useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/design-system/multi-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Trash } from '@phosphor-icons/react';
import type {
    DripCondition,
    DripConditionBehavior,
    DripConditionConfig,
    DripConditionContentLevel,
    DripConditionRule,
    RelativeDateParams,
} from '@/types/course-settings';
import {
    createDefaultRule,
    formatDripRule,
    generateDripConditionId,
    getLevelDisplayName,
    getRuleTypeDisplayName,
} from '@/utils/drip-conditions';

const RULE_TYPES = [
    'relative_date',
    'date_based',
    'sequential',
    'completion_based',
    'prerequisite',
] as const;

function toLocalDateTimeString(isoString: string): string {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
        date.getHours()
    )}:${pad(date.getMinutes())}`;
}

function toISOStringFromLocal(local: string): string {
    const date = new Date(local);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export interface ContentDripConditionDialogProps {
    open: boolean;
    onClose: () => void;
    /** Which level of content this dialog is editing. */
    level: DripConditionContentLevel;
    itemId: string | null;
    itemName: string | null;
    packageId: string | null;
    /** Every condition saved for this institute. */
    dripConditions: DripCondition[];
    onSave: (updatedConditions: DripCondition[]) => Promise<void>;
    /** Items at the same level, offered as prerequisites. */
    siblings?: Array<{ id: string; name: string }>;
    /** Institute master switch — surfaced so an admin isn't editing a dead rule. */
    dripEnabled?: boolean;
    /** Whether saved rules are actually applied to learners yet. */
    enforcing?: boolean;
}

/**
 * Unlock rules for one subject, module or chapter.
 *
 * Deliberately edits ONE rule set per item rather than a list of them: the
 * learner side applies the first enabled condition it finds for an item, so a
 * second condition on the same item is never evaluated and only ever misleads
 * whoever added it.
 */
export function ContentDripConditionDialog({
    open,
    onClose,
    level,
    itemId,
    itemName,
    packageId,
    dripConditions,
    onSave,
    siblings = [],
    dripEnabled = true,
    enforcing = false,
}: ContentDripConditionDialogProps) {
    const conditions = useMemo(
        () => (Array.isArray(dripConditions) ? dripConditions : []),
        [dripConditions]
    );
    const levelLabel = getLevelDisplayName(level);

    const existing = useMemo(
        () =>
            conditions.find(
                (c) => c.level === level && c.level_id === itemId && c.enabled !== false
            ),
        [conditions, level, itemId]
    );

    // A course-level condition targeting this level already governs the item;
    // adding a second rule here would be silently ignored at runtime.
    const courseWideConfigs = useMemo(
        () =>
            conditions
                .filter((c) => c.level === 'package' && c.level_id === packageId && c.enabled !== false)
                .flatMap((c) => (Array.isArray(c.drip_condition) ? c.drip_condition : []))
                .filter((config) => config.target === level && config.is_enabled !== false),
        [conditions, packageId, level]
    );

    const [behavior, setBehavior] = useState<DripConditionBehavior>('lock');
    const [isEnabled, setIsEnabled] = useState(true);
    const [rule, setRule] = useState<DripConditionRule>(() => createDefaultRule('relative_date'));
    const [saving, setSaving] = useState(false);

    // Reload the form whenever the dialog opens on a different item, otherwise
    // it keeps showing the rule of whichever item was opened first.
    useEffect(() => {
        if (!open) return;
        const config: DripConditionConfig | undefined = Array.isArray(existing?.drip_condition)
            ? existing?.drip_condition[0]
            : undefined;
        setBehavior(config?.behavior ?? 'lock');
        setIsEnabled(config?.is_enabled ?? true);
        setRule(config?.rules?.[0] ?? createDefaultRule('relative_date'));
    }, [open, itemId, existing]);

    // Params are a discriminated union across five rule types; each editor only
    // ever patches fields belonging to its own type, which the union cannot
    // express without re-deriving the rule type on every keystroke.
    const updateParams = (patch: Record<string, unknown>) =>
        setRule(
            (prev) =>
                ({
                    type: prev.type,
                    params: { ...(prev.params as unknown as Record<string, unknown>), ...patch },
                }) as unknown as DripConditionRule
        );

    const persist = async (next: DripCondition[]) => {
        try {
            setSaving(true);
            await onSave(next);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!itemId) return;
        const now = new Date().toISOString();
        const condition: DripCondition = {
            id: existing?.id ?? generateDripConditionId(),
            level,
            level_id: itemId,
            enabled: true,
            created_at: existing?.created_at ?? now,
            updated_at: now,
            drip_condition: [{ target: level, behavior, is_enabled: isEnabled, rules: [rule] }],
        };
        const next = existing
            ? conditions.map((c) => (c.id === existing.id ? condition : c))
            : [...conditions, condition];
        await persist(next);
    };

    const handleRemove = async () => {
        if (!existing) return;
        // The dialog this replaced refused to delete an active rule outright
        // and confirmed before any delete. Dropping the refusal is deliberate
        // (an admin unlocking content in a hurry should not have to disable a
        // rule first), but removing a live rule silently is not — this opens
        // content to every learner on the course.
        const live = Array.isArray(existing.drip_condition)
            ? existing.drip_condition[0]?.is_enabled !== false
            : false;
        const warning = live
            ? `Remove the unlock rule on "${itemName || levelLabel}"? It is active, so this ${levelLabel.toLowerCase()} opens for every learner immediately.`
            : `Remove the unlock rule on "${itemName || levelLabel}"?`;
        if (!window.confirm(warning)) return;
        await persist(conditions.filter((c) => c.id !== existing.id));
    };

    const renderRuleEditor = () => {
        switch (rule.type) {
            case 'relative_date': {
                const params = rule.params as RelativeDateParams;
                return (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label>Unlocks on day</Label>
                            <Input
                                type="number"
                                min={1}
                                value={params.unlock_on_day ?? 1}
                                onChange={(e) =>
                                    updateParams({
                                        unlock_on_day: Math.max(
                                            1,
                                            parseInt(e.target.value, 10) || 1
                                        ),
                                    })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Day 1 is the learner&apos;s first day of access.
                            </p>
                        </div>
                        <div className="space-y-1">
                            <Label>Counted from</Label>
                            <Select
                                value={params.anchor ?? 'enrollment'}
                                onValueChange={(v) => updateParams({ anchor: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="enrollment">
                                        Each learner&apos;s enrollment date
                                    </SelectItem>
                                    <SelectItem value="session_start">
                                        The batch start date
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Opens at</Label>
                            <Input
                                type="time"
                                value={params.unlock_time || '00:00'}
                                onChange={(e) =>
                                    updateParams({ unlock_time: e.target.value || '00:00' })
                                }
                            />
                        </div>
                    </div>
                );
            }

            case 'date_based': {
                const params = rule.params as { unlock_date: string };
                return (
                    <div className="space-y-1">
                        <Label>Release date</Label>
                        <Input
                            type="datetime-local"
                            value={params.unlock_date ? toLocalDateTimeString(params.unlock_date) : ''}
                            onChange={(e) =>
                                updateParams({ unlock_date: toISOStringFromLocal(e.target.value) })
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            The same calendar moment for every learner.
                        </p>
                    </div>
                );
            }

            case 'sequential': {
                const params = rule.params as { threshold: number };
                return (
                    <div className="space-y-1">
                        <Label>Previous {levelLabel.toLowerCase()} completed at least (%)</Label>
                        <Input
                            type="number"
                            min={0}
                            max={100}
                            value={params.threshold ?? 100}
                            onChange={(e) =>
                                updateParams({ threshold: parseInt(e.target.value, 10) || 0 })
                            }
                        />
                    </div>
                );
            }

            case 'completion_based': {
                const params = rule.params as {
                    metric: 'average_of_all' | 'average_of_last_n';
                    count?: number;
                    threshold: number;
                };
                return (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label>Metric</Label>
                            <Select
                                value={params.metric}
                                onValueChange={(v) => updateParams({ metric: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="average_of_all">Average of all</SelectItem>
                                    <SelectItem value="average_of_last_n">
                                        Average of last N
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {params.metric === 'average_of_last_n' && (
                            <div className="space-y-1">
                                <Label>How many</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={params.count ?? 1}
                                    onChange={(e) =>
                                        updateParams({
                                            count: Math.max(1, parseInt(e.target.value, 10) || 1),
                                        })
                                    }
                                />
                            </div>
                        )}
                        <div className="space-y-1">
                            <Label>Threshold %</Label>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={params.threshold ?? 0}
                                onChange={(e) =>
                                    updateParams({ threshold: parseInt(e.target.value, 10) || 0 })
                                }
                            />
                        </div>
                    </div>
                );
            }

            case 'prerequisite': {
                const params = rule.params as {
                    required_chapters?: string[];
                    threshold: number;
                };
                return (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label>Must finish first</Label>
                            <MultiSelect
                                options={siblings.map((s) => ({ label: s.name, value: s.id }))}
                                selected={params.required_chapters || []}
                                onChange={(ids) => updateParams({ required_chapters: ids })}
                                placeholder={`Select ${levelLabel.toLowerCase()}s`}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Completion threshold %</Label>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={params.threshold ?? 100}
                                onChange={(e) =>
                                    updateParams({ threshold: parseInt(e.target.value, 10) || 0 })
                                }
                            />
                        </div>
                    </div>
                );
            }

            default:
                return null;
        }
    };

    return (
        <MyDialog
            open={open}
            onOpenChange={onClose}
            heading={`Unlock rule — ${itemName || levelLabel}`}
        >
            <div className="space-y-4">
                {!dripEnabled && (
                    <Alert className="border-amber-200 bg-amber-50">
                        <Info className="size-4 text-amber-600" />
                        <AlertDescription className="text-sm text-amber-900">
                            Drip conditions are switched off for this institute, so nothing saved
                            here will lock content yet. Turn them on in Settings → Course →
                            Drip Conditions.
                        </AlertDescription>
                    </Alert>
                )}

                {dripEnabled && !enforcing && (
                    <Alert className="border-neutral-200 bg-neutral-50">
                        <Info className="size-4 text-neutral-500" />
                        <AlertDescription className="text-sm">
                            Rules are in preview: this saves, but learners are unaffected until
                            &ldquo;Apply unlock rules to learners&rdquo; is switched on in
                            Settings → Course → Drip Conditions.
                        </AlertDescription>
                    </Alert>
                )}

                {courseWideConfigs.length > 0 && (
                    <Alert className="border-blue-200 bg-blue-50">
                        <Info className="size-4 text-blue-600" />
                        <AlertDescription className="space-y-1 text-sm text-blue-900">
                            <div className="font-semibold">
                                A course-wide rule already covers every {levelLabel.toLowerCase()}
                            </div>
                            {courseWideConfigs.flatMap((config, ci) =>
                                config.rules.map((r, ri) => (
                                    <div key={`${ci}-${ri}`}>• {formatDripRule(r)}</div>
                                ))
                            )}
                            <div className="text-xs">
                                A rule saved here takes precedence for this
                                {` ${levelLabel.toLowerCase()}`}.
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-1">
                    <Label>Unlock when</Label>
                    <Select
                        value={rule.type}
                        onValueChange={(v) => setRule(createDefaultRule(v as DripConditionRule['type']))}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {RULE_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {getRuleTypeDisplayName(type)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="rounded-md border bg-white p-3">{renderRuleEditor()}</div>

                <div className="space-y-1">
                    <Label>Until then</Label>
                    <Select
                        value={behavior}
                        onValueChange={(v) => setBehavior(v as DripConditionBehavior)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="lock">
                                Show the card with a lock and the unlock date
                            </SelectItem>
                            <SelectItem value="hide">Hide it completely</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="drip-rule-enabled" className="font-medium">
                            Rule active
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Switch off to keep the rule but stop applying it.
                        </p>
                    </div>
                    <Switch
                        id="drip-rule-enabled"
                        checked={isEnabled}
                        onCheckedChange={setIsEnabled}
                    />
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                    <div>
                        {existing && (
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={handleRemove}
                                disabled={saving}
                            >
                                <Trash size={16} />
                                <span>Remove rule</span>
                            </MyButton>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {existing && <Badge variant="outline">Editing existing rule</Badge>}
                        <MyButton buttonType="secondary" onClick={onClose} disabled={saving}>
                            Cancel
                        </MyButton>
                        <MyButton onClick={handleSave} disabled={saving || !itemId}>
                            {saving ? 'Saving…' : 'Save'}
                        </MyButton>
                    </div>
                </div>
            </div>
        </MyDialog>
    );
}
