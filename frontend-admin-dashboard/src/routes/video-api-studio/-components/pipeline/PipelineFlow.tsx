import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    NodeTypes,
    type Node,
    Panel,
    ReactFlowProvider,
    useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type {
    NodeSlot,
    NodeState,
    PipelineState,
    ResearchArtifact,
    SceneSlot,
    ScoreArtifact,
    TalentArtifact,
} from './-utils/derive-pipeline-state';
import { buildPipelineGraph, type PipelineNodeData } from './-utils/build-pipeline-graph';
import { applyDagreLayout } from './-utils/apply-dagre-layout';
import { useBackgroundMusicTrack, useSceneThumbnails } from './-utils/use-timeline-json';
import { useVideoStatus } from './-utils/use-video-status';
import { NodeDetailSheet, type DetailTarget } from './NodeDetailSheet';
import { PitchNode } from './nodes/PitchNode';
import { ResearchNode } from './nodes/ResearchNode';
import { ScreenplayNode } from './nodes/ScreenplayNode';
import { NarrationNode } from './nodes/NarrationNode';
import { StoryboardNode } from './nodes/StoryboardNode';
import { FilmingNode } from './nodes/FilmingNode';
import { SceneNode } from './nodes/SceneNode';
import { TalentNode } from './nodes/TalentNode';
import { ScoreNode } from './nodes/ScoreNode';
import { FinalCutNode } from './nodes/FinalCutNode';

/**
 * Map of `nodeType` → component. Defined module-scope (not inside the
 * component) so React Flow doesn't warn about re-creating the registry on
 * every render — see https://reactflow.dev/error#002.
 */
const NODE_TYPES: NodeTypes = {
    pitch: PitchNode,
    research: ResearchNode,
    screenplay: ScreenplayNode,
    narration: NarrationNode,
    storyboard: StoryboardNode,
    filming: FilmingNode,
    scene: SceneNode,
    talent: TalentNode,
    score: ScoreNode,
    finalCut: FinalCutNode,
};

interface PipelineFlowProps {
    state: PipelineState;
    /**
     * Used to fetch `/status.generation_progress` for history-loaded videos
     * (where `currentGeneration.shotPlan` is `undefined`). Lets us hydrate
     * per-scene nodes for already-wrapped runs without touching the parent
     * derivation path.
     */
    apiKey?: string;
}

function PipelineFlowInner({ state, apiKey }: PipelineFlowProps) {
    const flow = useReactFlow();
    const fittedOnceRef = useRef(false);

    const [openTarget, setOpenTarget] = useState<DetailTarget | null>(null);

    const handleSheetOpenChange = useCallback((open: boolean) => {
        if (!open) setOpenTarget(null);
    }, []);

    /**
     * Fetch + parse the finished `time_based_frame.json` once the run is
     * wrapped, then enrich `state.scenes[]` with image / video URLs so
     * SceneNode thumbnails materialize without a backend change. Lazy: the
     * hook is `enabled: !!timelineUrl` so live runs don't fetch until the
     * timeline is finalized.
     */
    const { byIndex: thumbnails } = useSceneThumbnails(state.videoId, state.artifactUrls.timeline);

    /**
     * For history-loaded videos `currentGeneration` doesn't carry the
     * Director's shot plan, so `state.scenes` is empty and the diagram
     * falls back to the legacy single Filming counter. Fetching `/status`
     * gives us the canonical `generation_progress.shot_plan` (and
     * `cumulative_tokens`) so per-scene nodes can be hydrated for
     * already-finished runs too.
     */
    const { data: statusResp } = useVideoStatus(state.videoId, apiKey);
    const gp = statusResp?.generation_progress;
    const meta = statusResp?.metadata;

    // Background-music track from the timeline.json — wraps the Score node
    // for already-finished videos that used auto-generated music.
    const { track: musicTrack } = useBackgroundMusicTrack(
        state.videoId,
        state.artifactUrls.timeline
    );

    const enrichedState = useMemo<PipelineState>(() => {
        let working = state;

        // 1. Synthesize scenes from /status.shot_plan when the parent
        //    derivation didn't have it (history-loaded videos).
        if (working.scenes.length === 0 && gp?.shot_plan?.length) {
            const isWrapped = working.status === 'wrapped';
            const shotsCompleted = isWrapped ? gp.shot_plan.length : gp.shots_completed ?? 0;
            const errors = gp.errors ?? [];

            const synthesized: SceneSlot[] = gp.shot_plan.map((s, arrayIdx) => {
                // Defensive: if the BE payload is missing `shot_index`,
                // fall back to array position so the React Flow node ids
                // (which key off the array slot) stay unique. Without this
                // fallback every scene gets id `scene-undefined` and they
                // collapse to a single rendered position.
                const idx = typeof s.shot_index === 'number' ? s.shot_index : arrayIdx;
                const errEntry = errors.find((e) => e.shot_index === idx);
                let sceneState: NodeState = 'scheduled';
                if (isWrapped) sceneState = 'wrapped';
                else if (errEntry && !errEntry.retrying) sceneState = 'cut';
                else if (errEntry && errEntry.retrying) sceneState = 'reshoot';
                else if (idx < shotsCompleted) sceneState = 'wrapped';
                else if (idx === shotsCompleted) sceneState = 'in_production';
                return {
                    state: sceneState,
                    index: idx,
                    shotType: s.shot_type,
                    narrationExcerpt: s.narration_excerpt,
                    durationS: s.duration_s,
                    startTime: s.start_time,
                    endTime: s.end_time,
                    error: sceneState === 'cut' ? errEntry?.error : undefined,
                };
            });
            working = { ...working, scenes: synthesized };
        }

        // 2. Apply timeline thumbnails into whichever scenes set we have.
        if (working.scenes.length > 0 && Object.keys(thumbnails).length > 0) {
            const merged: SceneSlot[] = working.scenes.map((s) => {
                const t = thumbnails[s.index];
                if (!t || (!t.imageUrl && !t.videoUrl)) return s;
                return {
                    ...s,
                    imageUrl: t.imageUrl ?? s.imageUrl,
                    videoUrl: t.videoUrl ?? s.videoUrl,
                };
            });
            working = { ...working, scenes: merged };
        }

        // 3. Synthesize Talent slot from extra_metadata.host. Live runs
        //    populate `state.talent` directly from SSE counters in
        //    `derivePipelineFromLive`; this branch covers history-loaded
        //    videos where the FE never saw the avatar_* events.
        const isWrapped = working.status === 'wrapped';
        const isHalted = working.status === 'halted';
        if (!working.talent && meta?.host) {
            const host = meta.host;
            const hostEnabled = host.enabled !== false; // default true when block exists
            const isAvatar = host.type === 'avatar' || (!host.type && !!host.avatar);
            if (hostEnabled && isAvatar) {
                const outputs = host.outputs;
                const total = outputs?.host_shot_count ?? outputs?.shot_artifacts?.length ?? 0;
                const takes = (outputs?.shot_artifacts ?? []).map((a) => ({
                    shotIndex: a.shot_index,
                    hostImageUrl: a.host_image_url,
                    avatarVideoUrl: a.avatar_video_url,
                    durationS: a.duration_s_actual ?? a.duration_s,
                    status: a.status,
                    error: a.error,
                }));
                const completedTakes = takes.filter(
                    (t) => t.status === 'completed' || !!t.avatarVideoUrl || !!t.hostImageUrl
                );
                let talent: NodeSlot<TalentArtifact>;
                if (isWrapped || total > 0) {
                    talent = {
                        state: 'wrapped',
                        data: {
                            completed: completedTakes.length || total,
                            total: total || completedTakes.length,
                            takes,
                        },
                    };
                } else if (isHalted) {
                    talent = { state: 'cut', error: 'Talent cut from production' };
                } else {
                    talent = { state: 'scheduled' };
                }
                working = { ...working, talent };
            }
        }

        // 4. Synthesize Score slot from metadata.user_selections + music
        //    track. On wrapped runs the merged Lyria track lives in
        //    timeline.json's `meta.audio_tracks[]` — that's the audio URL
        //    we play in the detail sheet.
        const userSel = meta?.user_selections;
        const scoreEnabled =
            userSel?.background_music_enabled === true ||
            meta?.background_music_enabled === true ||
            !!musicTrack?.url;
        if (!working.score && scoreEnabled) {
            let score: NodeSlot<ScoreArtifact>;
            if (musicTrack?.url || isWrapped) {
                score = {
                    state: 'wrapped',
                    data: {
                        audioUrl: musicTrack?.url,
                        label: musicTrack?.label,
                    },
                };
            } else if (isHalted) {
                score = { state: 'cut', error: 'Score cut from production' };
            } else {
                score = { state: 'scheduled' };
            }
            working = { ...working, score };
        } else if (working.score && working.score.state === 'wrapped' && musicTrack?.url) {
            // Live derivation already wrapped the score (from
            // background_music_done) but didn't have the canonical
            // timeline.json URL. Backfill it now.
            const data = working.score.data;
            if (!data.audioUrl) {
                working = {
                    ...working,
                    score: {
                        state: 'wrapped',
                        data: {
                            ...data,
                            audioUrl: musicTrack.url,
                            label: data.label ?? musicTrack.label,
                        },
                    },
                };
            }
        }

        // 5. Research enrichment from `intent_outcomes` (Phase 4). The pre-
        //    script intent router doesn't emit SSE events, so live runs
        //    only know "URL in prompt → research probably running". For
        //    history-loaded videos, the persisted artifacts contain the
        //    actual sources / screenshots / search payload.
        const intent = meta?.intent_outcomes;
        const toolsEnabled = intent?.tools_enabled ?? [];
        const scrapeArt = intent?.scrape_url_artifacts;
        const searchArt = intent?.web_search_artifacts;
        const researchHappened =
            toolsEnabled.includes('scrape_url') ||
            toolsEnabled.includes('web_search') ||
            !!scrapeArt ||
            !!searchArt;
        if (researchHappened) {
            const liveResearchUrls =
                working.research?.state === 'wrapped'
                    ? working.research.data.urlsAttempted
                    : undefined;
            const enrichedData: ResearchArtifact = {
                scrapedAny: !!scrapeArt && !scrapeArt.error,
                searchedAny: !!searchArt && !searchArt.error,
                urlsAttempted: scrapeArt?.urls_attempted ?? liveResearchUrls,
                screenshots: (scrapeArt?.files_captured ?? [])
                    .filter((f) => !!f.url)
                    .map((f) => ({ url: f.url as string, name: f.name })),
                scrapedExcerpt: scrapeArt?.text_excerpt,
                searchAnswer: searchArt?.answer,
                sources: (searchArt?.sources ?? [])
                    .filter((s) => !!s.url)
                    .map((s) => ({
                        url: s.url as string,
                        host: s.host,
                        title: s.title,
                    })),
                searchQuery: searchArt?.query,
            };
            const research: NodeSlot<ResearchArtifact> =
                working.research?.state === 'in_production'
                    ? { state: 'in_production', partialData: enrichedData }
                    : working.research?.state === 'cut' || working.research?.state === 'reshoot'
                      ? working.research
                      : { state: 'wrapped', data: enrichedData };
            working = { ...working, research };
        }

        return working;
    }, [state, gp, thumbnails, meta, musicTrack]);

    /**
     * React Flow's `onNodeClick` is the canonical hook for "user clicked
     * node X" — DOM-level onClick on the custom node shell is unreliable
     * inside React Flow's event-handling wrapper.
     *
     * Final Cut is the embedded player + fullscreen-button combo; its own
     * controls handle clicks, so we explicitly skip the sheet for it.
     */
    const handleNodeClick = useCallback(
        (_event: React.MouseEvent, node: Node<PipelineNodeData>) => {
            const kind = node.data?.kind;
            if (!kind || kind === 'finalCut') return;
            if (kind === 'scene') {
                // Always return inside this branch so the narrowed `kind`
                // below is guaranteed not to be 'scene'.
                if (typeof node.data.sceneIndex === 'number') {
                    setOpenTarget({ kind: 'scene', sceneIndex: node.data.sceneIndex });
                }
                return;
            }
            setOpenTarget({ kind });
        },
        []
    );

    const { nodes, edges } = useMemo(() => {
        const built = buildPipelineGraph(enrichedState);
        const positioned = applyDagreLayout(built.nodes, built.edges, {
            rankdir: 'LR',
            rankSep: 60,
            nodeSep: 24,
            nodeSizeOverrides: built.nodeSizeOverrides,
        });

        // Post-process: when scene nodes exist, override their positions to
        // a deterministic horizontal row anchored to Storyboard's position.
        // Reasoning: dagre's LR layout for a long sequential chain
        // (Pitch→…→Storyboard→S0→S1→…→Sn→FinalCut) computed positions that
        // we couldn't visually verify were correct — most scenes ended up
        // either off-screen, at (0,0), or stacked. Manual positioning
        // guarantees every scene gets a unique spot and the
        // Storyboard→FinalCut visual span scales with N.
        const sceneNodes = positioned.filter((n) => n.data?.kind === 'scene');
        if (sceneNodes.length > 0) {
            const storyboard = positioned.find((n) => n.id === 'storyboard');
            const finalCut = positioned.find((n) => n.id === 'finalCut');
            if (storyboard && finalCut) {
                const sceneW = built.nodeSizeOverrides['scene-0']?.width ?? 200;
                const sceneH = built.nodeSizeOverrides['scene-0']?.height ?? 220;
                const sbW = built.nodeSizeOverrides.storyboard?.width ?? 280;
                const sbH = built.nodeSizeOverrides.storyboard?.height ?? 180;
                const sceneSpacing = 50;
                // Start scenes just to the right of Storyboard, at the
                // same vertical center as the linear chain so the flow
                // stays visually horizontal.
                let x = storyboard.position.x + sbW + 80;
                const sceneY = storyboard.position.y + (sbH - sceneH) / 2;
                const sceneRowEndX = (() => {
                    let cursor = x;
                    sceneNodes.forEach(() => {
                        cursor += sceneW + sceneSpacing;
                    });
                    return cursor;
                })();
                sceneNodes
                    .sort((a, b) => {
                        const ai = (a.data as { sceneIndex?: number }).sceneIndex ?? 0;
                        const bi = (b.data as { sceneIndex?: number }).sceneIndex ?? 0;
                        return ai - bi;
                    })
                    .forEach((node) => {
                        node.position = { x, y: sceneY };
                        x += sceneW + sceneSpacing;
                    });
                // Place Final Cut right after the last scene, aligned
                // vertically with the linear chain.
                const fcW = built.nodeSizeOverrides.finalCut?.width ?? 480;
                const fcH = built.nodeSizeOverrides.finalCut?.height ?? 280;
                finalCut.position = {
                    x: x + 20,
                    y: storyboard.position.y + (sbH - fcH) / 2,
                };
                // Ensure the linear-chain nodes also share that y so the
                // whole top row aligns. `research` is conditional but
                // included here so its dagre-computed x-position lands on
                // the same row when present.
                ['pitch', 'research', 'screenplay', 'narration'].forEach((id) => {
                    const n = positioned.find((p) => p.id === id);
                    const w = built.nodeSizeOverrides[id]?.width ?? 260;
                    const h = built.nodeSizeOverrides[id]?.height ?? 140;
                    if (n)
                        n.position = {
                            x: n.position.x,
                            y: storyboard.position.y + (sbH - h) / 2,
                        };
                    // Width referenced just to avoid unused-var lint.
                    void w;
                });
                void fcW;

                // ── Talent + Score (Phase 3): secondary row below the
                // scene strip. Both run in parallel as edges
                // Storyboard→Talent / Score→FinalCut. Centering them under
                // the scene strip keeps the two converging arrows readable.
                const talentNode = positioned.find((n) => n.id === 'talent');
                const scoreNode = positioned.find((n) => n.id === 'score');
                const branchY = sceneY + sceneH + 60;
                const branchNodeW = 260;
                const branchSpacing = 60;
                const branches = [talentNode, scoreNode].filter(Boolean);
                if (branches.length > 0) {
                    const sceneStripStart = storyboard.position.x + sbW + 80;
                    const sceneStripWidth = sceneRowEndX - sceneStripStart;
                    const totalBranchWidth =
                        branches.length * branchNodeW + (branches.length - 1) * branchSpacing;
                    let bx = sceneStripStart + (sceneStripWidth - totalBranchWidth) / 2;
                    // If the scene strip is narrower than the branch row,
                    // anchor branches at the strip start instead so they
                    // never start to the left of Storyboard.
                    if (bx < sceneStripStart) bx = sceneStripStart;
                    branches.forEach((n) => {
                        if (!n) return;
                        const w = built.nodeSizeOverrides[n.id]?.width ?? branchNodeW;
                        n.position = { x: bx, y: branchY };
                        bx += w + branchSpacing;
                    });
                }
            }
        }

        return { nodes: positioned, edges: built.edges };
    }, [enrichedState]);

    // Re-fit when the structural set of node states changes. Stable in
    // steady-state since the dependency only flips on real state changes.
    const stateSignature = useMemo(
        () =>
            nodes
                .map((n) => `${n.id}:${(n.data as { state: { status?: string } }).state.status}`)
                .join('|') + `:${nodes.length}`,
        [nodes]
    );
    useEffect(() => {
        if (nodes.length === 0) return;
        const id = requestAnimationFrame(() => {
            flow.fitView({ padding: 0.08, duration: fittedOnceRef.current ? 350 : 200 });
            fittedOnceRef.current = true;
        });
        return () => cancelAnimationFrame(id);
    }, [flow, nodes.length, stateSignature]);

    // Show MiniMap once the diagram has many scene nodes — otherwise the
    // user can't see where they are after zooming in. Threshold = 8 since
    // the linear chain alone is already 6 nodes.
    const showMiniMap = nodes.length > 8;

    return (
        <>
            {/* Suppress React Flow's default `.selected` outline. We render
                our own state-driven ring on `<BaseNodeShell>` / `<SceneNode>`,
                and a default box-shadow ring on top would double up.
                Scoped to this component via the parent class. */}
            <style>{`
                .pipeline-flow .react-flow__node.selected,
                .pipeline-flow .react-flow__node:focus,
                .pipeline-flow .react-flow__node:focus-visible {
                    outline: none;
                    box-shadow: none;
                }
            `}</style>
            <ReactFlow
                className="pipeline-flow"
                nodes={nodes}
                edges={edges}
                nodeTypes={NODE_TYPES}
                fitView
                // Scene-heavy runs (10–30+ shots in a single rank) need a
                // small min-zoom to fit-view the whole column. Below this
                // the legend's still readable thanks to the chunky icons.
                minZoom={0.15}
                maxZoom={1.4}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
                nodesConnectable={false}
                // selectable + draggable need to coexist for `onNodeClick` to
                // dispatch reliably across React Flow versions. We override
                // the visual selection state above so a "selected" highlight
                // isn't visible.
                elementsSelectable
                zoomOnScroll
                panOnScroll={false}
                defaultEdgeOptions={{ type: 'smoothstep' }}
                onNodeClick={handleNodeClick}
            >
                <Background gap={24} size={1} color="#e5e7eb" />
                <Controls position="bottom-left" showInteractive={false} />
                {showMiniMap && <MiniMap pannable zoomable className="!bg-white" />}
                <Panel
                    position="top-right"
                    className="m-3 rounded-md border bg-white px-2 py-1 text-[10px] text-muted-foreground shadow-sm"
                >
                    Click any stage for details
                </Panel>
            </ReactFlow>
            <NodeDetailSheet
                target={openTarget}
                state={enrichedState}
                onOpenChange={handleSheetOpenChange}
                apiKey={apiKey}
            />
        </>
    );
}

/**
 * Wrap with `ReactFlowProvider` so we can use `useReactFlow()` for
 * imperative fit-view. Without this, the hook throws.
 */
export function PipelineFlow(props: PipelineFlowProps) {
    return (
        <ReactFlowProvider>
            <div className="size-full min-h-[480px]">
                <PipelineFlowInner {...props} />
            </div>
        </ReactFlowProvider>
    );
}

// Internal helper exports for testing / re-use
export { applyDagreLayout, buildPipelineGraph };
export type { PipelineNodeData };
