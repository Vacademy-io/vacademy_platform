import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlignLeft,
    Camera,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    ExternalLink,
    Film,
    FileText,
    Layers,
    ListOrdered,
    Loader2,
    Mic,
    Music,
    Pause,
    Play,
    Sparkles,
    UserSquare2,
    Wand2,
    X,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    fetchScriptText,
    regenerateFrame,
    updateFrame,
    type VideoStatusUserSelections,
} from '../../-services/video-generation';
import { LatexRenderer } from '../LatexRenderer';
import { useSceneHtml } from './-utils/scenes-html-context';
import { NODE_LABELS, type PipelineNodeId } from './-utils/stage-vocab';
import type {
    NodeSlot,
    NodeState,
    PipelineState,
    ResearchArtifact,
    SceneSlot,
    StoryboardArtifact,
} from './-utils/derive-pipeline-state';

/**
 * What the sheet is currently showing. Stage kinds are singletons; scenes
 * carry their index since there are N of them.
 */
export type DetailTarget = { kind: PipelineNodeId } | { kind: 'scene'; sceneIndex: number };

interface NodeDetailSheetProps {
    /** What to show. `null` → sheet closed. */
    target: DetailTarget | null;
    state: PipelineState;
    onOpenChange: (open: boolean) => void;
    /**
     * Forwarded to deep-link affordances (e.g. SceneDetail's "Edit this
     * scene" button). The editor route accepts it as a search param so
     * authenticated calls — `frame/regenerate`, `frame/update`, render
     * status — work without re-prompting for credentials.
     */
    apiKey?: string;
}

const NODE_ICON: Record<PipelineNodeId, React.ReactNode> = {
    pitch: <Sparkles className="size-4" />,
    research: <ExternalLink className="size-4" />,
    beats: <ListOrdered className="size-4" />,
    screenplay: <FileText className="size-4" />,
    narration: <Mic className="size-4" />,
    storyboard: <Layers className="size-4" />,
    filming: <Camera className="size-4" />,
    talent: <UserSquare2 className="size-4" />,
    score: <Music className="size-4" />,
    finalCut: <Film className="size-4" />,
};

export function NodeDetailSheet({ target, state, onOpenChange, apiKey }: NodeDetailSheetProps) {
    const open = target !== null;
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
                {target && <DetailSheetContents target={target} state={state} apiKey={apiKey} />}
            </SheetContent>
        </Sheet>
    );
}

function DetailSheetContents({
    target,
    state,
    apiKey,
}: {
    target: DetailTarget;
    state: PipelineState;
    apiKey?: string;
}) {
    if (target.kind === 'scene') {
        const scene = state.scenes[target.sceneIndex];
        const sceneLabel = `Scene ${String(target.sceneIndex + 1).padStart(2, '0')}`;
        return (
            <>
                <SheetHeader className="space-y-1.5 border-b pb-3">
                    <SheetTitle className="flex items-center gap-2 text-base">
                        <span className="text-muted-foreground">
                            <Camera className="size-4" />
                        </span>
                        {sceneLabel}
                    </SheetTitle>
                    {scene && <SceneStateBadge sceneState={scene.state} />}
                </SheetHeader>
                <div className="mt-4">
                    {scene ? (
                        <SceneDetail scene={scene} state={state} apiKey={apiKey} />
                    ) : (
                        <p className="text-sm text-muted-foreground">Scene data not available.</p>
                    )}
                </div>
                <RunSummaryFooter state={state} />
            </>
        );
    }
    return (
        <>
            <SheetHeader className="space-y-1.5 border-b pb-3">
                <SheetTitle className="flex items-center gap-2 text-base">
                    <span className="text-muted-foreground">{NODE_ICON[target.kind]}</span>
                    {NODE_LABELS[target.kind]}
                </SheetTitle>
                <NodeStateBadge kind={target.kind} state={state} />
            </SheetHeader>
            <div className="mt-4">
                <NodeDetailBody kind={target.kind} state={state} />
            </div>
            <RunSummaryFooter state={state} />
        </>
    );
}

/**
 * Run-wide summary footer shown on every node sheet so the user always
 * has the "what did this whole video cost / where are its files" answer
 * without jumping back to the right rail.
 *
 * Renders four sections (each conditional, but the footer itself is always
 * shown for wrapped runs so the user has *something* useful even when token
 * data is missing on older history-restored runs):
 *   - Tokens (from cumulativeTokens, fall back to legacy tokenUsage)
 *   - Estimated cost
 *   - Elapsed (only present for runs that started in this session)
 *   - Artifact URLs (script / audio / words / timeline / mp4 / videoId)
 */
function RunSummaryFooter({ state }: { state: PipelineState }) {
    const cum = state.stats.cumulativeTokens;
    const tokenUsage = state.stats.tokenUsage;
    const totalTokens = cum?.total_tokens ?? tokenUsage?.total_tokens;
    const promptTokens = cum?.prompt_tokens ?? tokenUsage?.prompt_tokens;
    const completionTokens = cum?.completion_tokens ?? tokenUsage?.completion_tokens;
    const cost =
        cum?.estimated_cost_usd ??
        (tokenUsage as { estimated_cost_usd?: number | null } | null | undefined)
            ?.estimated_cost_usd;
    const elapsedMs = state.stats.elapsedMs;
    const imageCount = tokenUsage?.image_count;
    const ttsChars = tokenUsage?.tts_character_count;

    const hasAnyTokenData =
        totalTokens != null ||
        cost != null ||
        elapsedMs != null ||
        imageCount != null ||
        ttsChars != null;

    const artifacts = state.artifactUrls;
    const hasArtifacts =
        !!artifacts.script ||
        !!artifacts.audio ||
        !!artifacts.words ||
        !!artifacts.timeline ||
        !!artifacts.videoMp4;

    return (
        <div className="mt-6 space-y-4 border-t pt-3">
            <section>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Production budget
                </div>
                {hasAnyTokenData ? (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        {totalTokens != null && (
                            <>
                                <span className="text-muted-foreground">Total tokens</span>
                                <span className="text-right font-mono tabular-nums text-foreground">
                                    {totalTokens.toLocaleString()}
                                </span>
                            </>
                        )}
                        {promptTokens != null && (
                            <>
                                <span className="text-muted-foreground">· Prompt</span>
                                <span className="text-right font-mono tabular-nums text-muted-foreground">
                                    {promptTokens.toLocaleString()}
                                </span>
                            </>
                        )}
                        {completionTokens != null && (
                            <>
                                <span className="text-muted-foreground">· Completion</span>
                                <span className="text-right font-mono tabular-nums text-muted-foreground">
                                    {completionTokens.toLocaleString()}
                                </span>
                            </>
                        )}
                        {imageCount != null && imageCount > 0 && (
                            <>
                                <span className="text-muted-foreground">Images generated</span>
                                <span className="text-right font-mono tabular-nums text-foreground">
                                    {imageCount.toLocaleString()}
                                </span>
                            </>
                        )}
                        {ttsChars != null && ttsChars > 0 && (
                            <>
                                <span className="text-muted-foreground">TTS characters</span>
                                <span className="text-right font-mono tabular-nums text-foreground">
                                    {ttsChars.toLocaleString()}
                                </span>
                            </>
                        )}
                        {cost != null && (
                            <>
                                <span className="text-muted-foreground">Estimated cost</span>
                                <span className="text-right font-mono tabular-nums text-foreground">
                                    ${cost.toFixed(4)}
                                </span>
                            </>
                        )}
                        {elapsedMs != null && elapsedMs > 0 && (
                            <>
                                <span className="text-muted-foreground">Elapsed</span>
                                <span className="text-right font-mono tabular-nums text-foreground">
                                    {formatElapsed(elapsedMs)}
                                </span>
                            </>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        Token + cost telemetry wasn&apos;t persisted for this run. (Older videos
                        from before token accounting was added.)
                    </p>
                )}
                <p className="mt-2 text-[10px] text-muted-foreground">
                    Cumulative for the whole run. Per-stage breakdown isn&apos;t available yet.
                </p>
            </section>

            {hasArtifacts && (
                <section>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Artifacts
                    </div>
                    <div className="space-y-1 text-xs">
                        {artifacts.script && <ArtifactRow label="Script" url={artifacts.script} />}
                        {artifacts.audio && <ArtifactRow label="Narration" url={artifacts.audio} />}
                        {artifacts.words && (
                            <ArtifactRow label="Word timings" url={artifacts.words} />
                        )}
                        {artifacts.timeline && (
                            <ArtifactRow label="Timeline" url={artifacts.timeline} />
                        )}
                        {artifacts.videoMp4 && (
                            <ArtifactRow label="Rendered MP4" url={artifacts.videoMp4} />
                        )}
                    </div>
                </section>
            )}

            <section>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Run
                </div>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {state.videoId}
                </p>
            </section>
        </div>
    );
}

function formatElapsed(ms: number): string {
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
}

const STATE_BADGE: Record<NodeState, { label: string; cls: string; icon: React.ReactNode }> = {
    wrapped: {
        label: 'Wrapped',
        cls: 'border-green-200 bg-green-50 text-green-700',
        icon: <CheckCircle2 className="size-3" />,
    },
    in_production: {
        label: 'In production',
        cls: 'border-blue-200 bg-blue-50 text-blue-700',
        icon: <Loader2 className="size-3 animate-spin" />,
    },
    scheduled: {
        label: 'Scheduled',
        cls: 'border-gray-200 bg-gray-50 text-gray-700',
        icon: <Clock className="size-3" />,
    },
    cut: {
        label: 'Cut from production',
        cls: 'border-red-200 bg-red-50 text-red-700',
        icon: <XCircle className="size-3" />,
    },
    reshoot: {
        label: 'Reshoot needed',
        cls: 'border-amber-200 bg-amber-50 text-amber-700',
        icon: <Clock className="size-3" />,
    },
};

function SceneStateBadge({ sceneState }: { sceneState: NodeState }) {
    const v = STATE_BADGE[sceneState];
    return (
        <Badge variant="outline" className={`h-5 gap-1 ${v.cls}`}>
            {v.icon} {v.label}
        </Badge>
    );
}

function NodeStateBadge({ kind, state }: { kind: PipelineNodeId; state: PipelineState }) {
    const slot = (state as unknown as Record<string, NodeSlot<unknown>>)[kind];
    if (!slot) return null;
    const v = STATE_BADGE[slot.state];
    return (
        <Badge variant="outline" className={`h-5 gap-1 ${v.cls}`}>
            {v.icon} {v.label}
        </Badge>
    );
}

function NodeDetailBody({ kind, state }: { kind: PipelineNodeId; state: PipelineState }) {
    switch (kind) {
        case 'pitch':
            return <PitchDetail state={state} />;
        case 'research':
            return <ResearchDetail state={state} />;
        case 'beats':
            return <BeatsDetail state={state} />;
        case 'screenplay':
            return <ScreenplayDetail state={state} />;
        case 'narration':
            return <NarrationDetail state={state} />;
        case 'storyboard':
            return <StoryboardDetail state={state} />;
        case 'filming':
            return <FilmingDetail state={state} />;
        case 'talent':
            return <TalentDetail state={state} />;
        case 'score':
            return <ScoreDetail state={state} />;
        case 'finalCut':
            return <FinalCutDetail state={state} />;
    }
}

function BeatsDetail({ state }: { state: PipelineState }) {
    const slot = state.beats;
    if (!slot) {
        return (
            <div className="text-sm text-muted-foreground">
                BeatPlanner didn&apos;t run for this video.
            </div>
        );
    }
    if (slot.state === 'scheduled') {
        return (
            <div className="text-sm text-muted-foreground">
                The beat plan hasn&apos;t started yet.
            </div>
        );
    }
    if (slot.state === 'in_production') {
        return (
            <div className="text-sm text-muted-foreground">
                BeatPlanner is outlining the story beats. The Director will use these as the
                planning frame for shot boundaries — duration estimates are calibrated at
                ~150&nbsp;words/minute.
            </div>
        );
    }
    if (slot.state === 'cut' || slot.state === 'reshoot') {
        return <p className="text-sm text-red-700">{slot.error}</p>;
    }
    if (slot.state !== 'wrapped') return null;
    const beats = slot.data.beats ?? [];
    const count = slot.data.count ?? beats.length;
    return (
        <div className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Beat plan
            </div>
            <p className="text-xs text-muted-foreground">
                {count > 0
                    ? `${count} beat${count === 1 ? '' : 's'} feeding the Director's shot plan.`
                    : 'Beat plan locked. The Director used these beats to scope shots before TTS.'}
                {slot.data.wpm ? ` Duration estimates at ${slot.data.wpm.toFixed(0)} wpm.` : ''}
            </p>
            {beats.length > 0 && (
                <ol className="space-y-2 text-xs">
                    {beats.slice(0, 12).map((b: NonNullable<typeof beats>[number], i: number) => (
                        <li key={i} className="rounded-md border bg-muted/20 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{b.label || `Beat ${i + 1}`}</span>
                                {typeof b.durationEstimateS === 'number' && (
                                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                                        ~{b.durationEstimateS.toFixed(1)}s
                                    </span>
                                )}
                            </div>
                            {(b.intentRole || b.visualTypeHint) && (
                                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                    {[b.intentRole, b.visualTypeHint].filter(Boolean).join(' · ')}
                                </div>
                            )}
                            {b.intendedNarration && (
                                <p className="mt-1 line-clamp-2 italic text-foreground/70">
                                    &ldquo;{b.intendedNarration}&rdquo;
                                </p>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

// ── Per-node detail bodies ────────────────────────────────────────────────

function PitchDetail({ state }: { state: PipelineState }) {
    const pitchData = state.pitch.state === 'wrapped' ? state.pitch.data : undefined;
    const sel = pitchData?.userSelections;
    const [showAdvanced, setShowAdvanced] = useState(false);
    const promptText = (pitchData?.prompt ?? state.prompt ?? '').trim();

    return (
        <div className="space-y-4">
            {/* ── Brief ──────────────────────────────────────────────── */}
            <section className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    The brief
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                    {promptText ? (
                        <LatexRenderer
                            text={promptText}
                            className="whitespace-pre-wrap text-sm text-foreground"
                        />
                    ) : (
                        <p className="text-sm italic text-muted-foreground">
                            Prompt text not available for this run.
                        </p>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                    The original prompt that drove this production.
                </p>
            </section>

            {/* ── Configuration (always shown; falls back to message) ── */}
            <section className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Configuration
                </div>
                {sel ? (
                    <ConfigGrid
                        rows={[
                            ['Content type', formatLabel(sel.content_type ?? state.contentType)],
                            ['Quality tier', formatLabel(sel.quality_tier)],
                            ['Orientation', formatLabel(sel.orientation ?? state.orientation)],
                            ['Target duration', sel.target_duration],
                            ['Target audience', sel.target_audience],
                            ['Language', sel.language],
                            ['Voice', formatVoice(sel.voice_gender, sel.tts_provider)],
                            ['Voice ID', sel.voice_id || undefined],
                            ['Captions', formatBool(sel.captions_enabled)],
                            ['Background music', formatBool(sel.background_music_enabled)],
                            ['Sound effects', formatBool(sel.sound_effects_enabled)],
                            ['Host avatar', formatHost(sel)],
                            ['Reference files', formatCount(sel.reference_files_count)],
                            ['Target stage', sel.target_stage],
                        ]}
                    />
                ) : (
                    <p className="text-xs text-muted-foreground">
                        Configuration snapshot not persisted for this run. (Older videos predate the
                        user_selections snapshot in /status.)
                    </p>
                )}
            </section>

            {/* ── Advanced (collapsible — only when config exists) ───── */}
            {sel && (
                <section className="space-y-2">
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((v) => !v)}
                        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    >
                        <span>{showAdvanced ? '▾' : '▸'}</span> Advanced
                    </button>
                    {showAdvanced && (
                        <ConfigGrid
                            rows={[
                                ['Model', sel.model],
                                ['HTML quality', formatLabel(sel.html_quality)],
                                ['Sub-shots enabled', formatBool(sel.sub_shots_enabled)],
                                [
                                    'Routing overrides',
                                    formatRoutingOverrides(sel.routing_overrides),
                                ],
                                [
                                    'Visual preferences',
                                    formatVisualPreferences(sel.visual_preferences),
                                ],
                                ['Avatar image URL', sel.avatar_image_url || undefined],
                                ['Input video IDs', formatList(sel.input_video_ids)],
                                ['Input video audio', formatLabel(sel.input_video_audio)],
                                [
                                    'Mute TTS on source clips',
                                    formatBool(sel.mute_tts_on_source_clips_kwarg),
                                ],
                                [
                                    'Background music volume',
                                    sel.background_music_volume != null
                                        ? sel.background_music_volume.toFixed(2)
                                        : undefined,
                                ],
                            ]}
                            emptyMessage="No advanced overrides recorded."
                        />
                    )}
                </section>
            )}
        </div>
    );
}

/**
 * Two-column key/value grid. Rows with empty values are auto-omitted —
 * callers list every field unconditionally and `ConfigGrid` decides what
 * actually renders. Keeps Pitch's Configuration block clean across the
 * wide variation in what user_selections actually contains per run.
 */
function ConfigGrid({
    rows,
    emptyMessage,
}: {
    rows: Array<[string, string | undefined | null]>;
    emptyMessage?: string;
}) {
    const filled = rows.filter(([, v]) => v != null && v !== '');
    if (filled.length === 0) {
        return emptyMessage ? (
            <p className="text-xs text-muted-foreground">{emptyMessage}</p>
        ) : null;
    }
    return (
        <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-xs">
            {filled.map(([k, v]) => (
                <Fragment key={k}>
                    <span className="text-muted-foreground">{k}</span>
                    <span className="break-all text-right text-foreground">{v}</span>
                </Fragment>
            ))}
        </div>
    );
}

// ── Formatters for ConfigGrid rows ──────────────────────────────────────
//
// All return `undefined` when there's nothing meaningful to show so the
// grid auto-omits the row. Boolean fields collapse to 'On'/'Off'; snake_case
// strings get prettified to Title Case.

function formatLabel(v: string | undefined | null): string | undefined {
    if (!v) return undefined;
    return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatBool(v: boolean | undefined | null): string | undefined {
    if (v == null) return undefined;
    return v ? 'On' : 'Off';
}

function formatCount(n: number | undefined | null): string | undefined {
    if (n == null || n === 0) return undefined;
    return n.toString();
}

function formatVoice(gender: string | undefined, provider: string | undefined): string | undefined {
    if (!gender && !provider) return undefined;
    const parts = [gender, provider].filter(Boolean).map((p) => formatLabel(p as string));
    return parts.join(' · ');
}

function formatHost(sel: VideoStatusUserSelections): string | undefined {
    const generate = sel.generate_avatar;
    const hostType = sel.host?.type;
    if (!generate && !hostType) return 'None';
    if (hostType === 'avatar' || generate) {
        const id = (sel.host?.avatar as { saved_avatar_id?: string } | undefined)?.saved_avatar_id;
        return id ? `Avatar (${id})` : 'Avatar';
    }
    if (hostType === 'raw') return 'Raw clips';
    return formatLabel(hostType);
}

function formatList(arr: string[] | undefined | null): string | undefined {
    if (!arr || arr.length === 0) return undefined;
    return arr.join(', ');
}

function formatRoutingOverrides(o: Record<string, unknown> | null | undefined): string | undefined {
    if (!o) return undefined;
    const tools = (o as { tools?: Record<string, boolean | null> }).tools;
    if (!tools) return JSON.stringify(o);
    const flags = Object.entries(tools)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}=${v ? 'on' : 'off'}`);
    return flags.length ? flags.join(', ') : undefined;
}

function formatVisualPreferences(
    p: Record<string, unknown> | null | undefined
): string | undefined {
    if (!p) return undefined;
    const entries = Object.entries(p).filter(([, v]) => v != null && v !== 'auto');
    if (entries.length === 0) return undefined;
    return entries.map(([k, v]) => `${k}=${String(v)}`).join(', ');
}

function ResearchDetail({ state }: { state: PipelineState }) {
    const slot = state.research;
    if (!slot) {
        return (
            <p className="text-sm text-muted-foreground">
                No external research was needed for this brief.
            </p>
        );
    }
    if (slot.state === 'cut' || slot.state === 'reshoot') {
        return <p className="text-sm text-red-700">{slot.error}</p>;
    }
    if (slot.state === 'scheduled') {
        return (
            <p className="text-sm text-muted-foreground">Research desk hasn&apos;t opened yet.</p>
        );
    }
    // Both `wrapped` and `in_production` carry payload data — narrow once
    // and extract whichever sub-fields are present.
    const data: Partial<ResearchArtifact> =
        slot.state === 'wrapped'
            ? slot.data
            : slot.state === 'in_production'
              ? slot.partialData ?? {}
              : {};

    const urlsAttempted = data.urlsAttempted ?? [];
    const screenshots = data.screenshots ?? [];
    const sources = data.sources ?? [];
    const scrapedExcerpt = data.scrapedExcerpt;
    const searchAnswer = data.searchAnswer;
    const searchQuery = data.searchQuery;

    return (
        <div className="space-y-4">
            {slot.state === 'in_production' && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                    <Loader2 className="mr-1.5 inline size-3 animate-spin" />
                    Investigating sources… results will populate as the intent router finishes its
                    sweep.
                </div>
            )}

            {urlsAttempted.length > 0 && (
                <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        URLs scraped
                    </div>
                    <ul className="space-y-1">
                        {urlsAttempted.map((u, i) => (
                            <li
                                key={i}
                                className="flex items-center gap-2 truncate rounded-md border bg-card px-2 py-1.5 text-xs"
                            >
                                <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                                <a
                                    href={u}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="truncate text-foreground hover:text-blue-700"
                                >
                                    {u}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {screenshots.length > 0 && (
                <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Page captures
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {screenshots.map((s, i) => (
                            <a
                                key={i}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group overflow-hidden rounded-lg border bg-gray-100 hover:border-blue-300"
                            >
                                <img
                                    src={s.url}
                                    alt={s.name ?? `capture ${i + 1}`}
                                    loading="lazy"
                                    className="aspect-video w-full object-cover transition group-hover:opacity-90"
                                />
                                {s.name && (
                                    <div className="truncate border-t bg-white px-2 py-1 text-[10px] text-muted-foreground">
                                        {s.name}
                                    </div>
                                )}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {scrapedExcerpt && (
                <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Scraped excerpt
                    </div>
                    <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 font-sans text-xs leading-relaxed text-foreground/80">
                        {scrapedExcerpt}
                    </pre>
                </div>
            )}

            {searchQuery && (
                <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Web search query
                    </div>
                    <p className="rounded-md border bg-card px-2 py-1.5 font-mono text-xs text-foreground">
                        {searchQuery}
                    </p>
                </div>
            )}

            {searchAnswer && (
                <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Synthesized answer
                    </div>
                    <p className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-foreground/80">
                        {searchAnswer}
                    </p>
                </div>
            )}

            {sources.length > 0 && (
                <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Cited sources
                    </div>
                    <ul className="space-y-1">
                        {sources.map((s, i) => (
                            <li key={i}>
                                <a
                                    href={s.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs hover:bg-muted/40"
                                >
                                    <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{s.title || s.host || s.url}</span>
                                    {s.host && s.title && (
                                        <span className="ml-auto truncate text-[10px] text-muted-foreground">
                                            {s.host}
                                        </span>
                                    )}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {urlsAttempted.length === 0 &&
                screenshots.length === 0 &&
                sources.length === 0 &&
                !scrapedExcerpt &&
                !searchAnswer && (
                    <p className="text-sm text-muted-foreground">
                        Research wrapped, but the captured artifacts aren&apos;t available for this
                        run.
                    </p>
                )}
        </div>
    );
}

function ScreenplayDetail({ state }: { state: PipelineState }) {
    const slot = state.screenplay;
    // History-restored wrapped runs sometimes have `slot.data.scriptUrl`
    // unset (the History sidebar doesn't always hydrate it). Fall back to
    // `state.artifactUrls.script`, which is populated from the same /status
    // source and the PipelineFlow enrichment can backfill.
    const scriptUrl =
        (slot.state === 'wrapped' ? slot.data.scriptUrl : undefined) ?? state.artifactUrls.script;
    const [text, setText] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [fetchFailed, setFetchFailed] = useState(false);
    useEffect(() => {
        if (!scriptUrl) return;
        setLoading(true);
        setFetchFailed(false);
        fetchScriptText(scriptUrl)
            .then((raw) => {
                let display = raw;
                try {
                    const parsed = JSON.parse(raw);
                    display =
                        parsed.script ||
                        parsed.narration ||
                        parsed.narration_script ||
                        parsed.text ||
                        JSON.stringify(parsed, null, 2);
                } catch {
                    /* leave as raw text */
                }
                setText(display);
            })
            .catch(() => {
                setText(null);
                setFetchFailed(true);
            })
            .finally(() => setLoading(false));
    }, [scriptUrl]);

    const handleCopy = async () => {
        if (!text) return;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    if (slot.state !== 'wrapped') {
        return (
            <div className="text-sm text-muted-foreground">
                Screenplay isn&apos;t finished yet — sit tight while the writer&apos;s room drafts
                the narration.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                {scriptUrl && (
                    <a
                        href={scriptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                    >
                        <ExternalLink className="size-3" />
                        Open raw file
                    </a>
                )}
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleCopy}
                    disabled={!text}
                >
                    <Copy className="size-3" />
                    {copied ? 'Copied!' : 'Copy script'}
                </Button>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Loading screenplay…
                    </div>
                ) : text ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                        {text}
                    </pre>
                ) : !scriptUrl ? (
                    <p className="text-sm text-muted-foreground">
                        Screenplay URL not available for this run. The narration audio + word
                        timings are still accessible from the Narration node.
                    </p>
                ) : fetchFailed ? (
                    <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                            Inline preview failed to load. Use{' '}
                            <span className="font-medium text-foreground">Open raw file</span> above
                            to view the screenplay directly.
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            (S3 CORS, network drop, or the file is no longer present at the
                            persisted URL.)
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Could not load the screenplay text.
                    </p>
                )}
            </div>
        </div>
    );
}

function NarrationDetail({ state }: { state: PipelineState }) {
    const slot = state.narration;
    if (slot.state !== 'wrapped') {
        return (
            <div className="text-sm text-muted-foreground">Narration isn&apos;t recorded yet.</div>
        );
    }
    const { audioUrl, wordsUrl } = slot.data;
    return (
        <div className="space-y-4">
            {audioUrl && (
                <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Voiceover
                    </div>
                    {/* Native controls give scrub / volume / playback rate. */}
                    <audio controls preload="none" className="w-full">
                        <source src={audioUrl} type="audio/mpeg" />
                    </audio>
                    <a
                        href={audioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                        <ExternalLink className="size-3" />
                        Open audio file
                    </a>
                </div>
            )}
            {wordsUrl && <WordTimingsList wordsUrl={wordsUrl} />}
        </div>
    );
}

function WordTimingsList({ wordsUrl }: { wordsUrl: string }) {
    const [words, setWords] = useState<Array<{ word: string; start: number; end: number }> | null>(
        null
    );
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(true);
        fetch(wordsUrl)
            .then((r) => r.json())
            .then((j) => setWords(Array.isArray(j) ? j : null))
            .catch(() => setWords(null))
            .finally(() => setLoading(false));
    }, [wordsUrl]);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <AlignLeft className="size-3 text-muted-foreground" />
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Word timings
                </div>
                {words && (
                    <span className="text-[11px] text-muted-foreground">{words.length} words</span>
                )}
            </div>
            {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Loading timings…
                </div>
            ) : !words ? (
                <p className="text-xs text-muted-foreground">Could not load timings.</p>
            ) : (
                <div className="flex max-h-64 flex-wrap gap-1 overflow-y-auto rounded-md border bg-muted/20 p-3">
                    {words.map((w, i) => (
                        <span
                            key={i}
                            className="inline-flex items-baseline gap-0.5 rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-800"
                            title={`${w.start.toFixed(2)}s – ${w.end.toFixed(2)}s`}
                        >
                            {w.word}
                            <span className="text-[9px] text-blue-400">{w.start.toFixed(1)}s</span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function StoryboardDetail({ state }: { state: PipelineState }) {
    const slot = state.storyboard;
    if (slot.state !== 'wrapped') {
        return (
            <div className="text-sm text-muted-foreground">
                Storyboard isn&apos;t mapped yet — director&apos;s still planning shots.
            </div>
        );
    }
    // Storyboard's own scenes can be empty on history-restored wrapped
    // runs (the live SSE shotPlan never arrived). The enriched `state.scenes`
    // is synthesized from /status.shot_plan by PipelineFlow's enrichedState
    // memo, so it's the more reliable source for the wrapped list.
    const storyScenes = (slot.data as StoryboardArtifact).scenes;
    const scenes =
        storyScenes.length > 0
            ? storyScenes
            : state.scenes.map((s) => ({
                  index: s.index,
                  shotType: s.shotType,
                  startTime: s.startTime,
                  endTime: s.endTime,
                  durationS: s.durationS,
                  narrationExcerpt: s.narrationExcerpt,
              }));
    if (scenes.length === 0) {
        return (
            <div className="text-sm text-muted-foreground">
                Shot plan finalized — scene details aren&apos;t available for this run, but each
                scene still appears as its own node in the diagram.
            </div>
        );
    }
    return (
        <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {scenes.length} scenes mapped
            </div>
            <ol className="space-y-1.5">
                {scenes.map((s) => (
                    <li key={s.index} className="rounded-lg border bg-card p-3 text-xs shadow-sm">
                        <div className="mb-1 flex items-center gap-2">
                            <span className="font-mono tabular-nums text-muted-foreground">
                                {String(s.index + 1).padStart(2, '0')}
                            </span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground">
                                {s.shotType.replace(/_/g, ' ')}
                            </span>
                            <span className="ml-auto tabular-nums text-muted-foreground">
                                {s.startTime.toFixed(1)}s – {s.endTime.toFixed(1)}s ·{' '}
                                {s.durationS.toFixed(1)}s
                            </span>
                        </div>
                        {s.narrationExcerpt && (
                            <p className="italic text-foreground/80">
                                &ldquo;{s.narrationExcerpt}&rdquo;
                            </p>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
}

function FilmingDetail({ state }: { state: PipelineState }) {
    const slot = state.filming;
    if (slot.state === 'cut') {
        return <p className="text-sm text-red-700">{slot.error}</p>;
    }
    let completed = 0;
    let total = 0;
    if (slot.state === 'wrapped') {
        completed = slot.data.shotsCompleted;
        total = slot.data.shotsTotal;
    } else if (slot.state === 'in_production' && slot.partialData) {
        completed = slot.partialData.shotsCompleted ?? 0;
        total = slot.partialData.shotsTotal ?? 0;
    }
    // History-restored wrapped runs may have lost the shotsCompleted/Total
    // counters but the enriched `state.scenes` is synthesized from
    // /status.shot_plan. Use it as the canonical count when the filming
    // slot's own counter is missing — otherwise we'd render "hasn't
    // started" on a video that's already done.
    const wrappedWithoutCounter = slot.state === 'wrapped' && total === 0;
    if (wrappedWithoutCounter && state.scenes.length > 0) {
        total = state.scenes.length;
        completed = state.scenes.filter((s) => s.state === 'wrapped').length || state.scenes.length;
    }
    const isWrapped = slot.state === 'wrapped';
    return (
        <div className="space-y-3">
            {total > 0 ? (
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {isWrapped ? 'Scenes wrapped' : 'Scenes filmed'}
                    </div>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                        {completed}{' '}
                        <span className="text-base text-muted-foreground">/ {total}</span>
                    </p>
                </div>
            ) : isWrapped ? (
                <p className="text-sm text-muted-foreground">
                    Filming wrapped — per-scene counters aren&apos;t available for this run.
                </p>
            ) : (
                <p className="text-sm text-muted-foreground">Filming hasn&apos;t started yet.</p>
            )}
            <p className="text-xs text-muted-foreground">
                Each scene appears as its own node in the diagram on tier-Premium and above — click
                any scene there to view its narration excerpt and stills.
            </p>
        </div>
    );
}

function SceneDetail({
    scene,
    state,
    apiKey,
}: {
    scene: SceneSlot;
    state: PipelineState;
    apiKey?: string;
}) {
    const timeline = state.artifactUrls.timeline;
    const html = useSceneHtml(scene.index);
    // `playKey` bumps every time the user hits "Play this beat" so the
    // iframe re-mounts and any JS-driven animations restart from t=0.
    const [playKey, setPlayKey] = useState(0);
    const handleRestartIframe = () => setPlayKey((k) => k + 1);
    // Regenerate is only useful when the run has wrapped — pre-HTML the
    // BE has no timeline.json to find the frame in, and `frame/regenerate`
    // would fail with a 400 ("Generate HTML stage first").
    const canRegen = !!timeline && !!apiKey;

    const narration = state.narration;
    const narrationAudioUrl = narration.state === 'wrapped' ? narration.data.audioUrl : undefined;

    const isAiVideoScene = scene.shotType === 'AI_VIDEO_HERO';
    return (
        <div className="space-y-4">
            {/* Header row: shot type + duration / time range */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground">
                    {scene.shotType.replace(/_/g, ' ')}
                </span>
                {isAiVideoScene && (
                    <span
                        className="rounded bg-violet-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-700"
                        title="Generated by fal.ai Veo 3.1 Lite"
                    >
                        ✨ AI VIDEO
                    </span>
                )}
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {scene.startTime.toFixed(1)}s – {scene.endTime.toFixed(1)}s ·{' '}
                    {scene.durationS.toFixed(1)}s
                </span>
            </div>

            {isAiVideoScene && (
                <div className="rounded-md border border-violet-200 bg-violet-50/60 p-3 text-xs text-violet-900">
                    <div className="mb-1 font-medium">AI-generated video shot</div>
                    <div className="text-violet-700">
                        This shot was generated with fal.ai Veo. Cost contributes to the per-video
                        AI video cap. Editing inside the editor re-runs the Veo call.
                    </div>
                </div>
            )}

            {/* Hero media — prefer the rendered HTML when present so the
                user can actually "play" the beat (animations, video tags
                inside the HTML, etc). Falls back to the AI B-roll clip,
                then the still, then a text-only notice. */}
            {html ? (
                <SceneHtmlPreview html={html} sceneIndex={scene.index} playKey={playKey} />
            ) : scene.videoUrl ? (
                <div className="overflow-hidden rounded-lg border bg-black">
                    <video
                        src={scene.videoUrl}
                        controls
                        muted
                        playsInline
                        preload="metadata"
                        className="aspect-video w-full"
                    />
                </div>
            ) : scene.imageUrl ? (
                <div className="overflow-hidden rounded-lg border bg-gray-100">
                    <img
                        src={scene.imageUrl}
                        alt={`Scene ${scene.index + 1}`}
                        className="aspect-video w-full object-cover"
                    />
                </div>
            ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-lg border bg-gray-50 text-xs text-muted-foreground">
                    Text-driven scene — no still or B-roll on this beat
                </div>
            )}

            {/* Narration-synced playback. Crops the wrapped voiceover to
                this scene's [startTime, endTime] window and re-keys the
                HTML iframe so its animations restart in lock-step with
                the audio — the closest "play this beat" we can get
                without rendering the MP4. */}
            {html && narrationAudioUrl && (
                <SceneNarrationPlayer
                    audioUrl={narrationAudioUrl}
                    startTime={scene.startTime}
                    endTime={scene.endTime}
                    onRestartIframe={handleRestartIframe}
                />
            )}

            {/* Regenerate this scene — inline AI remake panel. Drives the
                same `frame/regenerate` + `frame/update` endpoints the
                editor uses, but without leaving the pipeline view. The
                user types what to change, we round-trip through the LLM,
                show "ready", and on accept persist + invalidate the
                timeline cache so the new HTML reflects on next render. */}
            {canRegen && (
                <RegenerateScenePanel
                    videoId={state.videoId}
                    apiKey={apiKey!}
                    scene={scene}
                    timelineUrl={timeline!}
                />
            )}

            {/* Narration excerpt */}
            {scene.narrationExcerpt && (
                <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Narration
                    </div>
                    <p className="rounded-lg border bg-muted/20 p-3 text-sm italic leading-relaxed text-foreground">
                        &ldquo;{scene.narrationExcerpt}&rdquo;
                    </p>
                </div>
            )}

            {/* Asset links */}
            {(scene.imageUrl || scene.videoUrl) && (
                <div className="space-y-1 text-xs">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Assets
                    </div>
                    {scene.imageUrl && <ArtifactRow label="Still" url={scene.imageUrl} />}
                    {scene.videoUrl && <ArtifactRow label="B-roll clip" url={scene.videoUrl} />}
                </div>
            )}

            {scene.error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    <div className="mb-1 font-medium">Production error</div>
                    {scene.error}
                </div>
            )}
        </div>
    );
}

/**
 * Inline AI-regenerate UI for a single scene, surfaced from the pipeline's
 * SceneDetail sheet. Mirrors the editor's "Remake this shot with AI" panel
 * (PropertiesPanel.tsx) but skips the editor canvas — the user accepts the
 * new HTML directly and we persist via `frame/update`.
 *
 * Three-state machine:
 *   `idle`     — user composing the prompt
 *   `loading`  — regenerateFrame() in flight (~10–60s on Gemini Pro)
 *   `preview`  — new HTML returned; user can Accept (persist) or Discard
 *
 * On Accept we invalidate the cached timeline JSON so the next pipeline
 * state read picks up the new HTML; the rendered MP4 is downstream of that.
 */
function RegenerateScenePanel({
    videoId,
    apiKey,
    scene,
    timelineUrl,
}: {
    videoId: string;
    apiKey: string;
    scene: SceneSlot;
    timelineUrl: string;
}) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [phase, setPhase] = useState<'idle' | 'loading' | 'preview'>('idle');
    // Pre-fill with the narration excerpt so users editing for tone /
    // copy have a reasonable starting point.
    const [prompt, setPrompt] = useState(scene.narrationExcerpt ?? '');
    const [result, setResult] = useState<{ frameIndex: number; newHtml: string } | null>(null);

    const handleToggle = () => {
        if (!open) {
            setPhase('idle');
            setResult(null);
            // Re-seed prompt when reopening — the narration is the most
            // useful starting point for a re-roll.
            setPrompt(scene.narrationExcerpt ?? '');
        }
        setOpen((v) => !v);
    };

    const handleGenerate = async () => {
        const trimmed = prompt.trim();
        if (!trimmed) {
            toast.error('Describe what to change before regenerating.');
            return;
        }
        setPhase('loading');
        try {
            // BE resolves frame by `inTime <= ts < exitTime` — same logic
            // as the editor uses. Nudge by 0.05s to land inside the shot.
            const ts = Math.max(scene.startTime + 0.05, 0);
            const res = await regenerateFrame(videoId, apiKey, ts, trimmed);
            setResult({ frameIndex: res.frame_index, newHtml: res.new_html });
            setPhase('preview');
        } catch (err) {
            setPhase('idle');
            toast.error(err instanceof Error ? err.message : 'Regeneration failed');
        }
    };

    const handleAccept = async () => {
        if (!result) return;
        setPhase('loading');
        try {
            await updateFrame(videoId, apiKey, result.frameIndex, result.newHtml);
            // Force the next pipeline-flow read to refetch the timeline so
            // the new HTML reflects in the SceneDetail thumbnail too. The
            // queryKey shape mirrors `useTimelineJson`'s definition.
            queryClient.invalidateQueries({ queryKey: ['video-timeline', videoId, timelineUrl] });
            toast.success('Scene regenerated. Re-render the MP4 to see the change.');
            setOpen(false);
            setPhase('idle');
            setResult(null);
        } catch (err) {
            setPhase('preview');
            toast.error(err instanceof Error ? err.message : 'Failed to save');
        }
    };

    const handleDiscard = () => {
        setPhase('idle');
        setResult(null);
    };

    if (!open) {
        return (
            <Button variant="default" size="sm" onClick={handleToggle} className="w-full gap-2">
                <Wand2 className="size-3.5" />
                Regenerate this scene with AI
            </Button>
        );
    }

    return (
        <div className="space-y-2 rounded-lg border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-1.5">
                <Wand2 className="size-3.5 text-indigo-600" />
                <span className="text-xs font-medium text-foreground">
                    Regenerate Scene {String(scene.index + 1).padStart(2, '0')}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpen(false)}
                    className="ml-auto size-6"
                    title="Close"
                    disabled={phase === 'loading'}
                >
                    <X className="size-3.5" />
                </Button>
            </div>
            <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what to change… e.g. 'Make the title green and add a subtle fade-in for the subtitle'"
                disabled={phase === 'loading'}
                className="w-full resize-none rounded-md border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-indigo-400 focus:outline-none disabled:opacity-60"
            />

            {phase === 'preview' ? (
                <div className="space-y-1.5">
                    <p className="text-[11px] text-green-700">
                        ✓ New version ready. Accept to apply, or discard and try a different prompt.
                    </p>
                    <div className="flex gap-1.5">
                        <Button
                            size="sm"
                            onClick={handleAccept}
                            className="h-7 flex-1 gap-1 bg-green-600 text-[11px] text-white hover:bg-green-700"
                        >
                            <Check className="size-3" />
                            Accept &amp; save
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDiscard}
                            className="h-7 flex-1 gap-1 text-[11px]"
                        >
                            <X className="size-3" />
                            Discard
                        </Button>
                    </div>
                </div>
            ) : (
                <Button
                    size="sm"
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || phase === 'loading'}
                    className="h-7 w-full gap-1.5 bg-indigo-600 text-[11px] text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                    {phase === 'loading' ? (
                        <>
                            <Loader2 className="size-3 animate-spin" />
                            Generating… (10–60s)
                        </>
                    ) : (
                        <>
                            <Wand2 className="size-3" />
                            Generate
                        </>
                    )}
                </Button>
            )}

            <p className="text-[10px] text-muted-foreground">
                The AI rewrites just this shot&apos;s HTML — narration, timing, and other shots stay
                untouched. After accepting, re-render the MP4 to see the result.
            </p>
        </div>
    );
}

/**
 * Embed a shot's rendered HTML in a sandboxed iframe at its native 1920×1080
 * design surface, scaled to fit the sheet's viewport width. ResizeObserver
 * keeps the scale correct as the sheet grows / shrinks (e.g. responsive
 * breakpoints, devtools toggle). Re-uses the same sandbox flags as
 * AIVideoPlayer so JS-driven animations + autoplay work.
 *
 * `key={`${sceneIndex}-${playKey}`}` on the iframe serves two purposes:
 *   - Switching between scenes forces a fresh document so animation timers
 *     from the previous scene don't bleed in.
 *   - Bumping `playKey` from the parent re-mounts the iframe so the user
 *     can replay the beat in lock-step with the narration audio.
 */
function SceneHtmlPreview({
    html,
    sceneIndex,
    playKey,
}: {
    html: string;
    sceneIndex: number;
    playKey?: number;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.3);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => {
            const w = el.getBoundingClientRect().width;
            if (w > 0) setScale(w / 1920);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <div
            ref={containerRef}
            className="relative aspect-video w-full overflow-hidden rounded-lg border bg-white"
        >
            <iframe
                key={`${sceneIndex}-${playKey ?? 0}`}
                title={`Scene ${sceneIndex + 1} HTML`}
                srcDoc={html}
                sandbox="allow-scripts allow-same-origin"
                allow="autoplay"
                className="absolute left-0 top-0 origin-top-left border-0"
                style={{
                    width: 1920,
                    height: 1080,
                    transform: `scale(${scale})`,
                }}
            />
        </div>
    );
}

/**
 * Plays the wrapped narration audio cropped to a single scene's time
 * window, in lock-step with a re-keyed HTML iframe. Single play head
 * inside this component — pause is real, "Play this beat" reseeks
 * audio to `startTime`, kicks the parent to restart the iframe, and
 * schedules an auto-pause at `endTime` via rAF (timeupdate granularity
 * is too coarse for short beats — we typically have 2-4s shots).
 *
 * We deliberately don't try to drive the iframe's internal animations
 * via postMessage — the rendered HTML doesn't subscribe to messages,
 * and re-mounting is the same effect with no contract.
 */
function SceneNarrationPlayer({
    audioUrl,
    startTime,
    endTime,
    onRestartIframe,
}: {
    audioUrl: string;
    startTime: number;
    endTime: number;
    onRestartIframe: () => void;
}) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const rafRef = useRef<number | null>(null);
    const [playing, setPlaying] = useState(false);

    // Stop the rAF auto-pause loop on unmount / scene switch — otherwise
    // a still-running tick can call `pause()` on a fresh audio element.
    useEffect(() => {
        return () => {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const handlePlay = async () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = Math.max(0, startTime);
        // Restart the iframe alongside the audio so animations re-trigger
        // from t=0 of this beat. We do this *before* play() so the tiny
        // remount delay doesn't desync.
        onRestartIframe();
        try {
            await audio.play();
        } catch (err) {
            // Likely autoplay-policy denial. Surface so the user can retry.
            toast.error(err instanceof Error ? err.message : 'Could not start playback');
            return;
        }
        setPlaying(true);

        const tick = () => {
            const a = audioRef.current;
            if (!a || a.paused) {
                rafRef.current = null;
                setPlaying(false);
                return;
            }
            if (a.currentTime >= endTime) {
                a.pause();
                setPlaying(false);
                rafRef.current = null;
                return;
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
    };

    const handlePause = () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        setPlaying(false);
        if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    return (
        <div className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    onClick={playing ? handlePause : handlePlay}
                    className="h-7 gap-1.5 text-[11px]"
                >
                    {playing ? (
                        <>
                            <Pause className="size-3" /> Pause
                        </>
                    ) : (
                        <>
                            <Play className="size-3" /> Play this beat with narration
                        </>
                    )}
                </Button>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {startTime.toFixed(1)}s – {endTime.toFixed(1)}s
                </span>
            </div>
            {/* Hidden control surface — the visible affordance is the
                button above. Keeping the element rendered (not just a
                bare <audio>) means users can right-click → save / inspect
                if they want the raw audio for the full timeline. */}
            <audio ref={audioRef} src={audioUrl} preload="metadata" controls className="w-full" />
        </div>
    );
}

function TalentDetail({ state }: { state: PipelineState }) {
    const slot = state.talent;
    if (!slot) {
        return (
            <div className="text-sm text-muted-foreground">No host configured for this run.</div>
        );
    }
    if (slot.state === 'cut' || slot.state === 'reshoot') {
        return <p className="text-sm text-red-700">{slot.error}</p>;
    }
    if (slot.state === 'scheduled') {
        return (
            <div className="text-sm text-muted-foreground">
                Talent is on the call sheet — recording starts after the storyboard is locked.
            </div>
        );
    }
    if (slot.state === 'in_production') {
        const completed = slot.partialData?.completed ?? 0;
        const total = slot.partialData?.total ?? 0;
        return (
            <div className="space-y-3">
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Takes recorded
                    </div>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                        {completed}{' '}
                        {total > 0 && (
                            <span className="text-base text-muted-foreground">/ {total}</span>
                        )}
                    </p>
                </div>
                <p className="text-xs text-muted-foreground">
                    Each take pairs a Seedream identity image with a slice of the narration audio,
                    then fal.ai renders the lip-synced talking head. Per-take previews appear once
                    the avatar batch wraps.
                </p>
            </div>
        );
    }

    if (slot.state !== 'wrapped') return null;

    const total = slot.data.total || slot.data.takes?.length || 0;
    const takes = (slot.data.takes ?? []).slice().sort((a, b) => a.shotIndex - b.shotIndex);
    return (
        <div className="space-y-4">
            <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Takes in the can
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {takes.length || total}{' '}
                    <span className="text-base text-muted-foreground">takes</span>
                </p>
            </div>
            {takes.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                    {takes.map((take) => (
                        <div
                            key={take.shotIndex}
                            className="overflow-hidden rounded-lg border bg-card text-xs shadow-sm"
                        >
                            <div className="aspect-video w-full bg-gray-100">
                                {take.avatarVideoUrl ? (
                                    <video
                                        src={take.avatarVideoUrl}
                                        controls
                                        muted
                                        playsInline
                                        preload="none"
                                        poster={take.hostImageUrl}
                                        className="size-full object-cover"
                                    />
                                ) : take.hostImageUrl ? (
                                    <img
                                        src={take.hostImageUrl}
                                        alt={`Take ${take.shotIndex + 1}`}
                                        className="size-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                                        No preview
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-1.5">
                                <span className="font-mono tabular-nums text-muted-foreground">
                                    Take {String(take.shotIndex + 1).padStart(2, '0')}
                                </span>
                                {take.durationS != null && (
                                    <span className="ml-auto tabular-nums text-muted-foreground">
                                        {take.durationS.toFixed(1)}s
                                    </span>
                                )}
                            </div>
                            {take.error && (
                                <p className="border-t bg-red-50 px-2 py-1 text-[10px] text-red-700">
                                    {take.error}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Performance is wrapped — per-take previews aren&apos;t available for this run.
                </p>
            )}
        </div>
    );
}

function ScoreDetail({ state }: { state: PipelineState }) {
    const slot = state.score;
    if (!slot) {
        return (
            <div className="text-sm text-muted-foreground">
                No background score was generated for this run.
            </div>
        );
    }
    if (slot.state === 'cut' || slot.state === 'reshoot') {
        return <p className="text-sm text-red-700">{slot.error}</p>;
    }
    if (slot.state === 'scheduled') {
        return (
            <div className="text-sm text-muted-foreground">
                Composer hasn&apos;t arrived on set yet.
            </div>
        );
    }
    if (slot.state === 'in_production') {
        const completed = slot.partialData?.segmentsCompleted ?? 0;
        const total = slot.partialData?.segmentsTotal ?? 0;
        return (
            <div className="space-y-3">
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Chunks composed
                    </div>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                        {completed}{' '}
                        {total > 0 && (
                            <span className="text-base text-muted-foreground">/ {total}</span>
                        )}
                    </p>
                </div>
                <p className="text-xs text-muted-foreground">
                    Google Lyria renders the score in chunks (~30s each), then a render worker
                    concatenates them into the final track that lives alongside the narration.
                </p>
            </div>
        );
    }

    if (slot.state !== 'wrapped') return null;

    const { audioUrl, label, segmentsTotal } = slot.data;
    return (
        <div className="space-y-4">
            {audioUrl ? (
                <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {label || 'Background Music'}
                    </div>
                    <audio controls preload="none" className="w-full">
                        <source src={audioUrl} type="audio/mpeg" />
                    </audio>
                    <a
                        href={audioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                        <ExternalLink className="size-3" />
                        Open audio file
                    </a>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Score wrapped — the merged track is mixed into the final cut.
                </p>
            )}
            {segmentsTotal != null && (
                <p className="text-xs text-muted-foreground">
                    Composed in {segmentsTotal} chunk{segmentsTotal === 1 ? '' : 's'} via Lyria.
                </p>
            )}
        </div>
    );
}

function FinalCutDetail({ state }: { state: PipelineState }) {
    const slot = state.finalCut;
    if (slot.state !== 'wrapped') {
        return <div className="text-sm text-muted-foreground">Final cut not assembled yet.</div>;
    }
    const { timelineUrl, audioUrl, wordsUrl } = slot.data;
    return (
        <div className="space-y-3">
            <p className="text-sm text-foreground">
                The final cut is the assembled timeline + voiceover. The embedded player on the
                Final Cut node has the same content; clicking{' '}
                <span className="font-medium">Watch fullscreen</span> there opens the full-bleed
                view.
            </p>
            <div className="space-y-1 text-xs">
                <ArtifactRow label="Timeline" url={timelineUrl} />
                {audioUrl && <ArtifactRow label="Audio" url={audioUrl} />}
                {wordsUrl && <ArtifactRow label="Word timings" url={wordsUrl} />}
            </div>
        </div>
    );
}

function ArtifactRow({ label, url }: { label: string; url: string }) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded border bg-muted/20 px-2 py-1.5 text-xs hover:bg-muted/40"
        >
            <ExternalLink className="size-3 text-muted-foreground" />
            <span className="font-medium text-foreground">{label}</span>
            <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
                {url.split('/').pop()}
            </span>
        </a>
    );
}
