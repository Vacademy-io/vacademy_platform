/**
 * Wizard Step 0 — INGEST.
 *
 * User picks indexed assets (multi-select), each auto-tagged with a handle
 * (v1, v2, i1, i2…) that's editable inline, writes a prompt describing the
 * video + arrangement intent, and sets target aspect + duration.
 *
 * Per-asset overrides (initial_range_s, exclude_ranges, audio/video-only) and
 * project-level preferences are accepted by the backend but their full UI is
 * a P1.5 polish pass — this step ships the core ingest + handles + prompt.
 *
 * Eligibility: only assets with status=COMPLETED can be picked. Videos +
 * images both qualify (Studio is multi-modal). Ineligible assets render
 * disabled with a reason.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Check,
    FilmStrip,
    Image as ImageIcon,
    PencilSimple,
    SlidersHorizontal,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import {
    listInputAssets,
    type InputAssetRecord,
} from '@/routes/video-api-studio/-services/input-asset';
import type {
    AssetOverrides,
    AssetRef,
    CreateProjectRequest,
    ModelOverrides,
    ProjectPreferences,
    TargetAspect,
} from '../services/studio-api';
import { ProjectPreferencesPanel } from './ProjectPreferencesPanel';
import { ModelOverridesPanel } from './ModelOverridesPanel';
import { AssetOverridesEditor, hasOverrides } from './AssetOverridesEditor';

interface PickedAsset {
    record: InputAssetRecord;
    handle: string;
    overrides: AssetOverrides;
}

interface IngestStepProps {
    apiKey: string;
    submitting: boolean;
    error?: string | null;
    onSubmit: (request: CreateProjectRequest) => void;
}

const ASPECT_OPTIONS: Array<{ id: TargetAspect; label: string }> = [
    { id: '16:9', label: 'Landscape 16:9' },
    { id: '9:16', label: 'Portrait 9:16' },
    { id: '1:1', label: 'Square 1:1' },
];

const DURATION_OPTIONS = [30, 60, 90, 120, 180];

/** Auto-handle: videos → v1,v2…; images → i1,i2…  */
function nextHandle(kind: 'video' | 'image', existing: PickedAsset[]): string {
    const prefix = kind === 'video' ? 'v' : 'i';
    const used = existing
        .map((p) => p.handle)
        .filter((h) => h.startsWith(prefix))
        .map((h) => parseInt(h.slice(prefix.length), 10))
        .filter((n) => !Number.isNaN(n));
    const next = used.length ? Math.max(...used) + 1 : 1;
    return `${prefix}${next}`;
}

export function IngestStep({ apiKey, submitting, error, onSubmit }: IngestStepProps) {
    const assetsQuery = useQuery({
        queryKey: ['studio-input-assets', apiKey],
        queryFn: () => listInputAssets(apiKey),
        enabled: !!apiKey,
        staleTime: 30_000,
    });

    const [picked, setPicked] = useState<PickedAsset[]>([]);
    const [prompt, setPrompt] = useState('');
    const [aspect, setAspect] = useState<TargetAspect>('16:9');
    const [durationS, setDurationS] = useState<number>(60);
    const [preferences, setPreferences] = useState<ProjectPreferences>({});
    const [modelOverrides, setModelOverrides] = useState<ModelOverrides>({});

    const { eligible, ineligible } = useMemo(() => {
        const eligible: InputAssetRecord[] = [];
        const ineligible: InputAssetRecord[] = [];
        for (const a of assetsQuery.data ?? []) {
            if (a.status === 'COMPLETED') eligible.push(a);
            else ineligible.push(a);
        }
        return { eligible, ineligible };
    }, [assetsQuery.data]);

    const pickedIds = useMemo(
        () => new Set(picked.map((p) => p.record.id)),
        [picked]
    );

    const toggle = (record: InputAssetRecord) => {
        setPicked((prev) => {
            if (prev.some((p) => p.record.id === record.id)) {
                return prev.filter((p) => p.record.id !== record.id);
            }
            const kind = record.kind === 'image' ? 'image' : 'video';
            return [...prev, { record, handle: nextHandle(kind, prev), overrides: {} }];
        });
    };

    const renameHandle = (assetId: string, handle: string) => {
        setPicked((prev) =>
            prev.map((p) => (p.record.id === assetId ? { ...p, handle } : p))
        );
    };

    const setOverrides = (assetId: string, overrides: AssetOverrides) => {
        setPicked((prev) =>
            prev.map((p) => (p.record.id === assetId ? { ...p, overrides } : p))
        );
    };

    const handleClash = useMemo(() => {
        const handles = picked.map((p) => p.handle.trim());
        return handles.some((h, i) => h && handles.indexOf(h) !== i);
    }, [picked]);

    const canSubmit =
        picked.length > 0 &&
        !handleClash &&
        picked.every((p) => p.handle.trim().length > 0) &&
        !submitting;

    const submit = () => {
        if (!canSubmit) return;
        const refs: AssetRef[] = picked.map((p) => ({
            asset_id: p.record.id,
            handle: p.handle.trim(),
            kind: p.record.kind === 'image' ? 'image' : 'video',
            mode: (p.record.mode as AssetRef['mode']) ?? null,
            // Only attach overrides when the user actually set something —
            // an empty {} would round-trip as a no-op but pollutes the record.
            overrides: hasOverrides(p.overrides) ? p.overrides : null,
        }));
        const hasPrefs = Object.values(preferences).some(
            (v) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
        );
        const hasModel = !!modelOverrides.default || !!modelOverrides.per_stage;
        const request: CreateProjectRequest = {
            source_asset_refs: refs,
            user_prompt: prompt.trim() || null,
            target_aspect: aspect,
            target_duration_s: durationS,
            preferences: hasPrefs ? preferences : null,
            model_overrides: hasModel ? modelOverrides : null,
        };
        onSubmit(request);
    };

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-lg font-semibold text-neutral-900">
                    Pick your source assets
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                    Choose the indexed videos and images you want in this video.
                    Each gets a short handle (like <code className="rounded bg-neutral-100 px-1">v1</code>)
                    you can reference in your prompt.
                </p>
            </header>

            {/* Asset grid */}
            {assetsQuery.isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-20 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50"
                        />
                    ))}
                </div>
            ) : eligible.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-600">
                    No indexed assets are ready yet. Upload + index videos or
                    images in the Assets tab first.
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {eligible.map((asset) => {
                        const isPicked = pickedIds.has(asset.id);
                        const pick = picked.find((p) => p.record.id === asset.id);
                        return (
                            <AssetCard
                                key={asset.id}
                                asset={asset}
                                picked={isPicked}
                                handle={pick?.handle}
                                overrides={pick?.overrides ?? {}}
                                onToggle={() => toggle(asset)}
                                onRename={(h) => renameHandle(asset.id, h)}
                                onOverridesChange={(o) => setOverrides(asset.id, o)}
                            />
                        );
                    })}
                </div>
            )}

            {ineligible.length > 0 && (
                <p className="text-xs text-neutral-500">
                    {ineligible.length} asset(s) still indexing or failed — not
                    selectable yet.
                </p>
            )}

            {handleClash && (
                <p className="text-xs font-medium text-rose-600">
                    Handles must be unique. Two assets share the same handle.
                </p>
            )}

            {/* Prompt */}
            <div className="space-y-2">
                <label
                    htmlFor="studio-prompt"
                    className="block text-sm font-semibold text-neutral-900"
                >
                    Describe the video
                </label>
                <textarea
                    id="studio-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    placeholder="e.g. Open with the intro from v1, then cut to the demo in v2. Keep it punchy — under a minute. Drop the i1 logo in the corner throughout."
                    className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
            </div>

            {/* Targets */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <span className="block text-sm font-semibold text-neutral-900">
                        Aspect ratio
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {ASPECT_OPTIONS.map((opt) => (
                            <Chip
                                key={opt.id}
                                active={aspect === opt.id}
                                onClick={() => setAspect(opt.id)}
                            >
                                {opt.label}
                            </Chip>
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <span className="block text-sm font-semibold text-neutral-900">
                        Target duration
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {DURATION_OPTIONS.map((d) => (
                            <Chip
                                key={d}
                                active={durationS === d}
                                onClick={() => setDurationS(d)}
                            >
                                {d < 60 ? `${d}s` : `${d / 60}m`}
                            </Chip>
                        ))}
                    </div>
                </div>
            </div>

            {/* Advanced — project-level preferences + model overrides */}
            <ProjectPreferencesPanel value={preferences} onChange={setPreferences} />
            <ModelOverridesPanel value={modelOverrides} onChange={setModelOverrides} />

            {error && (
                <p className="text-sm font-medium text-rose-600">{error}</p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
                <span className="text-sm text-neutral-500">
                    {picked.length} selected
                </span>
                <button
                    type="button"
                    onClick={submit}
                    disabled={!canSubmit}
                    className="inline-flex h-10 items-center gap-1.5 rounded-md bg-neutral-900 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {submitting ? 'Creating…' : 'Continue → Arrangement'}
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Asset card
// ---------------------------------------------------------------------------

function AssetCard({
    asset,
    picked,
    handle,
    overrides,
    onToggle,
    onRename,
    onOverridesChange,
}: {
    asset: InputAssetRecord;
    picked: boolean;
    handle?: string;
    overrides: AssetOverrides;
    onToggle: () => void;
    onRename: (handle: string) => void;
    onOverridesChange: (o: AssetOverrides) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const isImage = asset.kind === 'image';
    const overridden = hasOverrides(overrides);
    return (
        <div
            className={cn(
                'flex flex-col gap-2 rounded-lg border p-3 transition-colors',
                picked
                    ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
            )}
        >
            <button
                type="button"
                onClick={onToggle}
                className="flex items-start gap-2 text-left"
            >
                <span
                    className={cn(
                        'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded border',
                        picked
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-neutral-300 bg-white'
                    )}
                >
                    {picked && <Check weight="bold" className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                        {isImage ? (
                            <ImageIcon
                                weight="duotone"
                                className="size-3.5 shrink-0 text-neutral-500"
                            />
                        ) : (
                            <FilmStrip
                                weight="duotone"
                                className="size-3.5 shrink-0 text-neutral-500"
                            />
                        )}
                        <span className="truncate text-sm font-medium text-neutral-900">
                            {asset.name}
                        </span>
                    </span>
                    <span className="mt-0.5 block text-caption text-neutral-500">
                        {asset.kind}
                        {asset.mode ? ` · ${asset.mode}` : ''}
                    </span>
                </span>
            </button>

            {picked && (
                <div className="border-t border-neutral-200 pt-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-caption text-neutral-500">Handle</span>
                            {editing ? (
                                <input
                                    autoFocus
                                    value={handle ?? ''}
                                    onChange={(e) => onRename(e.target.value)}
                                    onBlur={() => setEditing(false)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') setEditing(false);
                                    }}
                                    className="h-6 w-16 rounded border border-neutral-300 px-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none"
                                />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setEditing(true)}
                                    className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                                >
                                    {handle}
                                    <PencilSimple className="size-3" />
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setOptionsOpen((o) => !o)}
                            className={cn(
                                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-caption font-medium transition-colors',
                                overridden
                                    ? 'bg-neutral-900 text-white'
                                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
                            )}
                            title="Per-asset options"
                        >
                            <SlidersHorizontal className="size-3" />
                            {optionsOpen ? 'Hide' : overridden ? 'Edited' : 'Options'}
                        </button>
                    </div>

                    {optionsOpen && (
                        <AssetOverridesEditor
                            kind={isImage ? 'image' : 'video'}
                            durationS={asset.duration_seconds}
                            value={overrides}
                            onChange={onOverridesChange}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

function Chip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors',
                active
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            )}
        >
            {children}
        </button>
    );
}
