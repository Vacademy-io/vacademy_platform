import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import { COUNSELLOR_RATING_RECOMPUTE } from '@/constants/urls';
import {
    fetchWorkbenchConfig,
    updateWorkbenchConfig,
    type WorkbenchConfig,
} from '@/routes/counsellors/-services/counsellor-workbench-services';

/**
 * Strategy form. Persists into LEAD_SETTING.workbench.rating via the
 * /counsellor-workbench/config endpoint — no dedicated strategy table.
 */
export function CounsellorRatingSettings() {
    const instituteId = getInstituteId();
    const [draft, setDraft] = useState<WorkbenchConfig | null>(null);
    const [saving, setSaving] = useState(false);
    const [recomputing, setRecomputing] = useState(false);

    const query = useQuery({
        queryKey: ['workbench-config', instituteId],
        enabled: !!instituteId,
        queryFn: () => fetchWorkbenchConfig(instituteId!),
    });

    useEffect(() => {
        if (query.data) setDraft({ ...query.data });
    }, [query.data]);

    if (!draft) {
        return (
            <section className="rounded-lg border border-neutral-200 bg-white p-4">
                <h3 className="text-h4 font-medium text-neutral-900">Counsellor rating</h3>
                <p className="text-subtitle text-neutral-500">Loading…</p>
            </section>
        );
    }

    async function handleSave() {
        if (!draft) return;
        setSaving(true);
        try {
            await updateWorkbenchConfig(draft);
            toast.success('Rating strategy saved');
        } catch (e) {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Save failed');
        } finally {
            setSaving(false);
        }
    }

    async function handleRecompute() {
        if (!instituteId) return;
        setRecomputing(true);
        try {
            const { data } = await authenticatedAxiosInstance.post<{ affected: number }>(
                COUNSELLOR_RATING_RECOMPUTE(instituteId)
            );
            toast.success(
                `Recomputed ratings for ${data.affected} counsellor${data.affected === 1 ? '' : 's'}`
            );
        } catch (e) {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Recompute failed');
        } finally {
            setRecomputing(false);
        }
    }

    const isStrategy = (draft.strategy_type ?? 'STRATEGY_BASED') === 'STRATEGY_BASED';

    return (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <h3 className="text-h4 font-medium text-neutral-900">Counsellor rating</h3>
                    <p className="text-caption text-neutral-500">
                        How counsellor scores are calculated. Strategy-based ratings recompute
                        nightly and on every conversion.
                    </p>
                </div>
                <MyButton buttonType="secondary" onClick={handleRecompute} disable={recomputing}>
                    {recomputing ? 'Recomputing…' : 'Recompute now'}
                </MyButton>
            </div>

            <div className="space-y-3">
                <div>
                    <label className="mb-1 block text-caption font-medium text-neutral-700">Strategy</label>
                    <select
                        className="w-full max-w-xs rounded border border-neutral-300 px-3 py-2"
                        value={draft.strategy_type ?? 'STRATEGY_BASED'}
                        onChange={(e) =>
                            setDraft({
                                ...draft,
                                strategy_type: e.target.value as 'STATIC' | 'STRATEGY_BASED',
                            })
                        }
                    >
                        <option value="STRATEGY_BASED">Strategy-based (computed)</option>
                        <option value="STATIC">Static (manual per counsellor)</option>
                    </select>
                </div>

                <NumberField
                    label="Starting rating (0–100)"
                    value={draft.starting_rating ?? 0}
                    onChange={(v) => setDraft({ ...draft, starting_rating: v })}
                />

                {isStrategy && (
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField
                            label="Window (days)"
                            value={draft.window_days ?? 90}
                            onChange={(v) => setDraft({ ...draft, window_days: v })}
                        />
                        <NumberField
                            label="Min sample size"
                            value={draft.min_sample_size ?? 5}
                            onChange={(v) => setDraft({ ...draft, min_sample_size: v })}
                        />
                        <NumberField
                            label="Weight: conversion (0–1)"
                            value={draft.w_conversion ?? 0.6}
                            step={0.05}
                            onChange={(v) => setDraft({ ...draft, w_conversion: v })}
                        />
                        <NumberField
                            label="Weight: velocity (0–1)"
                            value={draft.w_velocity ?? 0.4}
                            step={0.05}
                            onChange={(v) => setDraft({ ...draft, w_velocity: v })}
                        />
                        <NumberField
                            label="Ideal velocity (hours)"
                            value={draft.ideal_velocity_hours ?? 24}
                            onChange={(v) => setDraft({ ...draft, ideal_velocity_hours: v })}
                        />
                        <NumberField
                            label="Worst velocity (hours)"
                            value={draft.worst_velocity_hours ?? 720}
                            onChange={(v) => setDraft({ ...draft, worst_velocity_hours: v })}
                        />
                    </div>
                )}
            </div>

            <div className="mt-4 flex justify-end">
                <MyButton buttonType="primary" onClick={handleSave} disable={saving}>
                    {saving ? 'Saving…' : 'Save strategy'}
                </MyButton>
            </div>
        </section>
    );
}

function NumberField({
    label,
    value,
    step = 1,
    onChange,
}: {
    label: string;
    value: number;
    step?: number;
    onChange: (v: number) => void;
}) {
    return (
        <div>
            <label className="mb-1 block text-caption font-medium text-neutral-700">{label}</label>
            <input
                type="number"
                step={step}
                className="w-full rounded border border-neutral-300 px-3 py-2"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
            />
        </div>
    );
}
