/**
 * Per-stage LLM model override editor (P1.5).
 *
 * Controlled — parent owns `ModelOverrides`. A single "default model" dropdown
 * mass-applies to every user-overridable stage; an optional per-stage accordion
 * overrides individual stages. Mirrors the AI-video ModelOverridesPanel mental
 * model. Pinned stages aren't shown — they're not user-overridable (V200).
 *
 * The 4 user-overridable Studio stages (AI_VIDEO_STUDIO.md §13.2):
 *   studio_arrangement · studio_cuts · studio_overlays · studio_audio
 */
import { useState } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useAIModelsList } from '@/hooks/useAiModels';
import type { ModelOverrides } from '../services/studio-api';

interface ModelOverridesPanelProps {
    value: ModelOverrides;
    onChange: (next: ModelOverrides) => void;
}

const USER_OVERRIDABLE_STAGES: Array<{ id: string; label: string; hint: string }> = [
    { id: 'studio_arrangement', label: 'Arrangement', hint: 'Pick + order clips' },
    { id: 'studio_cuts', label: 'Cuts', hint: 'Trim silences + off-topic' },
    { id: 'studio_overlays', label: 'Overlays', hint: 'Titles, captions, graphics' },
    { id: 'studio_audio', label: 'Audio', hint: 'Music, SFX, transitions' },
];

export function ModelOverridesPanel({ value, onChange }: ModelOverridesPanelProps) {
    const [open, setOpen] = useState(false);
    const [perStageOpen, setPerStageOpen] = useState(false);
    const modelsQuery = useAIModelsList({ use_case: 'video' });
    const models = modelsQuery.data?.models ?? [];

    const setDefault = (modelId: string) =>
        onChange({ ...value, default: modelId || null });

    const setStage = (stage: string, modelId: string) => {
        const per = { ...(value.per_stage ?? {}) };
        if (modelId) per[stage] = modelId;
        else delete per[stage];
        onChange({ ...value, per_stage: Object.keys(per).length ? per : null });
    };

    return (
        <div className="rounded-lg border border-neutral-200 bg-white">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
                <span className="text-sm font-semibold text-neutral-900">
                    AI model
                    <span className="ml-2 font-normal text-neutral-500">
                        optional — defaults are tuned per tier
                    </span>
                </span>
                {open ? (
                    <CaretDown className="size-4 text-neutral-500" />
                ) : (
                    <CaretRight className="size-4 text-neutral-500" />
                )}
            </button>

            {open && (
                <div className="space-y-4 border-t border-neutral-200 px-4 py-4">
                    <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-center sm:gap-3">
                        <span className="text-sm font-medium text-neutral-700">
                            Default model
                        </span>
                        <ModelSelect
                            models={models}
                            loading={modelsQuery.isLoading}
                            value={value.default ?? ''}
                            onChange={setDefault}
                            placeholder="Use tier default"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setPerStageOpen((o) => !o)}
                        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
                    >
                        {perStageOpen ? (
                            <CaretDown className="size-3.5" />
                        ) : (
                            <CaretRight className="size-3.5" />
                        )}
                        Customize per stage
                    </button>

                    {perStageOpen && (
                        <div className="space-y-3 rounded-md bg-neutral-50 p-3">
                            {USER_OVERRIDABLE_STAGES.map((stage) => (
                                <div
                                    key={stage.id}
                                    className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-center sm:gap-3"
                                >
                                    <span className="text-sm text-neutral-700">
                                        {stage.label}
                                        <span className="block text-caption text-neutral-400">
                                            {stage.hint}
                                        </span>
                                    </span>
                                    <ModelSelect
                                        models={models}
                                        loading={modelsQuery.isLoading}
                                        value={value.per_stage?.[stage.id] ?? ''}
                                        onChange={(m) => setStage(stage.id, m)}
                                        placeholder={
                                            value.default
                                                ? 'Use default model'
                                                : 'Use tier default'
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ModelSelect({
    models,
    loading,
    value,
    onChange,
    placeholder,
}: {
    models: Array<{ model_id: string; name: string; provider: string }>;
    loading: boolean;
    value: string;
    onChange: (modelId: string) => void;
    placeholder: string;
}) {
    return (
        <select
            value={value}
            disabled={loading}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
                'h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900',
                'focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900',
                'disabled:opacity-50'
            )}
        >
            <option value="">{loading ? 'Loading models…' : placeholder}</option>
            {models.map((m) => (
                <option key={m.model_id} value={m.model_id}>
                    {m.name} ({m.provider})
                </option>
            ))}
        </select>
    );
}
