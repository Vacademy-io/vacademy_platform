import { useEffect, useState } from 'react';
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
    Loader2,
    Mic,
    Music,
    Sparkles,
    UserSquare2,
    Wand2,
    X,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchScriptText, regenerateFrame, updateFrame } from '../../-services/video-generation';
import { LatexRenderer } from '../LatexRenderer';
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
        </>
    );
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

// ── Per-node detail bodies ────────────────────────────────────────────────

function PitchDetail({ state }: { state: PipelineState }) {
    return (
        <div className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                The brief
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
                <LatexRenderer
                    text={state.prompt}
                    className="whitespace-pre-wrap text-sm text-foreground"
                />
            </div>
            <p className="text-xs text-muted-foreground">
                The original prompt that drove this production.
            </p>
        </div>
    );
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
    const scriptUrl = slot.state === 'wrapped' ? slot.data.scriptUrl : undefined;
    const [text, setText] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!scriptUrl) return;
        setLoading(true);
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
            .catch(() => setText(null))
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
    const scenes = (slot.data as StoryboardArtifact).scenes;
    if (scenes.length === 0) {
        return (
            <div className="text-sm text-muted-foreground">
                Shot plan finalized — every scene appears as its own node in the diagram. Click any
                scene there to inspect it.
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
    return (
        <div className="space-y-3">
            {total > 0 ? (
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Scenes filmed
                    </div>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                        {completed}{' '}
                        <span className="text-base text-muted-foreground">/ {total}</span>
                    </p>
                </div>
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
    // Regenerate is only useful when the run has wrapped — pre-HTML the
    // BE has no timeline.json to find the frame in, and `frame/regenerate`
    // would fail with a 400 ("Generate HTML stage first").
    const canRegen = !!timeline && !!apiKey;

    return (
        <div className="space-y-4">
            {/* Header row: shot type + duration / time range */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground">
                    {scene.shotType.replace(/_/g, ' ')}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {scene.startTime.toFixed(1)}s – {scene.endTime.toFixed(1)}s ·{' '}
                    {scene.durationS.toFixed(1)}s
                </span>
            </div>

            {/* Hero media */}
            {scene.videoUrl ? (
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
