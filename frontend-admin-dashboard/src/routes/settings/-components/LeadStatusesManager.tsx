import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { Plus, Trash, DotsSixVertical, Star } from '@phosphor-icons/react';
import {
    useLeadStatuses,
    saveLeadStatuses,
    LEAD_STATUSES_QUERY_KEY,
    type LeadStatusDraft,
} from '@/hooks/use-lead-statuses';
import { DEFAULT_STATUS_COLOR } from '@/hooks/use-lead-settings';

/**
 * Table-backed Lead Statuses editor. Loads the institute's statuses, lets the admin add /
 * rename / recolour / reorder / set-default / remove, and persists everything in one Save via the
 * lead-status CRUD endpoints. Replaces the JSON-based customStatuses card.
 */
export default function LeadStatusesManager() {
    const queryClient = useQueryClient();
    const { statuses, isLoading } = useLeadStatuses();

    const [rows, setRows] = useState<LeadStatusDraft[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setRows(
            statuses.map((s) => ({
                id: s.id,
                status_key: s.status_key,
                label: s.label,
                color: s.color,
                display_order: s.display_order,
                is_default: s.is_default,
                is_system: s.is_system,
            }))
        );
        setHasChanges(false);
    }, [statuses]);

    const update = (i: number, patch: Partial<LeadStatusDraft>) => {
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
        setHasChanges(true);
    };
    const remove = (i: number) => {
        setRows((prev) => prev.filter((_, idx) => idx !== i));
        setHasChanges(true);
    };
    const add = () => {
        setRows((prev) => [
            ...prev,
            { label: '', color: DEFAULT_STATUS_COLOR, display_order: prev.length + 1, is_default: false },
        ]);
        setHasChanges(true);
    };
    const setDefault = (i: number) => {
        setRows((prev) => prev.map((r, idx) => ({ ...r, is_default: idx === i })));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveLeadStatuses(statuses, rows);
            await queryClient.invalidateQueries({ queryKey: LEAD_STATUSES_QUERY_KEY });
            toast.success('Lead statuses saved');
            setHasChanges(false);
        } catch {
            toast.error('Failed to save lead statuses');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Lead Statuses</CardTitle>
                <CardDescription>
                    The stages a lead moves through in your pipeline (e.g. New, Interested, Converted).
                    Rename, recolour, reorder, set a default for new leads, or remove them. Stored in the
                    database so you can filter and report on them.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading statuses…</p>
                ) : (
                    <>
                        {/* Live preview */}
                        {rows.some((s) => s.label.trim()) && (
                            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
                                {rows
                                    .filter((s) => s.label.trim())
                                    .map((s, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                                            // Inline style: status colour is arbitrary user-picked hex.
                                            style={{
                                                backgroundColor: `${s.color}14`,
                                                color: s.color,
                                                borderColor: `${s.color}40`,
                                            }}
                                        >
                                            <span
                                                className="size-1.5 rounded-full"
                                                style={{ backgroundColor: s.color }}
                                            />
                                            {s.label}
                                            {s.is_default && <span className="opacity-60">· default</span>}
                                        </span>
                                    ))}
                            </div>
                        )}

                        {/* Editable rows */}
                        <div className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200">
                            {rows.length === 0 && (
                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                    No statuses yet. Add your first pipeline stage below.
                                </p>
                            )}
                            {rows.map((s, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3 bg-white px-3 py-2.5 transition-colors hover:bg-neutral-50"
                                >
                                    <DotsSixVertical className="size-4 shrink-0 text-neutral-300" />

                                    {/* Colour swatch */}
                                    <label
                                        className="relative size-7 shrink-0 cursor-pointer rounded-md border border-neutral-200 shadow-sm transition-transform hover:scale-105"
                                        // Inline style: arbitrary user-picked status colour.
                                        style={{ backgroundColor: s.color || DEFAULT_STATUS_COLOR }}
                                        title="Change colour"
                                    >
                                        <input
                                            type="color"
                                            value={s.color || DEFAULT_STATUS_COLOR}
                                            onChange={(e) => update(i, { color: e.target.value })}
                                            className="absolute inset-0 size-full cursor-pointer opacity-0"
                                            aria-label={`Colour for ${s.label || 'status'}`}
                                        />
                                    </label>

                                    <Input
                                        placeholder="Status name (e.g. Interested)"
                                        value={s.label}
                                        onChange={(e) => update(i, { label: e.target.value })}
                                        className="h-9 flex-1 border-transparent bg-transparent shadow-none focus-visible:border-input focus-visible:bg-white"
                                    />

                                    <MyButton
                                        buttonType="text"
                                        layoutVariant="icon"
                                        scale="small"
                                        aria-label={s.is_default ? 'Default status' : 'Set as default'}
                                        onClick={() => setDefault(i)}
                                        className={
                                            s.is_default
                                                ? 'shrink-0 !text-warning-500'
                                                : 'shrink-0 !text-neutral-300 hover:!text-warning-500'
                                        }
                                    >
                                        <Star className="size-4" weight={s.is_default ? 'fill' : 'regular'} />
                                    </MyButton>

                                    {s.is_system ? (
                                        <span
                                            className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500"
                                            title="Default status — can be renamed/recoloured but not deleted"
                                        >
                                            Default
                                        </span>
                                    ) : (
                                        <MyButton
                                            buttonType="text"
                                            layoutVariant="icon"
                                            scale="small"
                                            aria-label={`Remove ${s.label || 'status'}`}
                                            onClick={() => remove(i)}
                                            className="shrink-0 !text-neutral-400 hover:!bg-danger-50 hover:!text-danger-600"
                                        >
                                            <Trash className="size-4" />
                                        </MyButton>
                                    )}
                                </div>
                            ))}
                        </div>

                        <MyButton
                            buttonType="secondary"
                            onClick={add}
                            className="w-full border-dashed"
                        >
                            <span className="flex items-center gap-2">
                                <Plus className="size-4" />
                                Add status
                            </span>
                        </MyButton>

                        <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
                            <span className="text-xs text-muted-foreground">
                                The starred status is applied to brand-new leads.
                            </span>
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                onClick={handleSave}
                                disable={saving || !hasChanges}
                            >
                                {saving ? 'Saving…' : 'Save statuses'}
                            </MyButton>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
