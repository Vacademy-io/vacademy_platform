/**
 * Translate a `PipelineState` into the React Flow `nodes[]` + `edges[]`
 * shape. Returns *un-positioned* nodes — pass through `applyDagreLayout`
 * before handing to React Flow.
 *
 * Phase 2: when the Director's shot plan is known, Filming explodes into
 * N individual `scene` nodes branching off Storyboard, all converging at
 * Final Cut. When the shot plan is empty (free / standard tier without a
 * director), we fall back to a single `filming` counter node — the legacy
 * Phase 1 layout — so the diagram stays meaningful for those runs too.
 */

import type { Edge, Node } from 'reactflow';
import type { PipelineState } from './derive-pipeline-state';

/**
 * Distinct node "kinds" that the React Flow runtime maps to custom
 * components via `nodeTypes`. `'scene'` is the only kind that has multiple
 * instances per pipeline — every other kind has at most one node.
 */
export type PipelineNodeKind =
    | 'pitch'
    | 'research'
    | 'beats'
    | 'screenplay'
    | 'narration'
    | 'storyboard'
    | 'shotPlanner'
    | 'narrationWriter'
    | 'filming'
    | 'scene'
    | 'talent'
    | 'score'
    | 'finalCut'
    /**
     * Decorative-only — synthesized by `PipelineFlow` after positioning
     * the talent / score branch row. Renders the dashed "B-roll lanes"
     * container; never produced by `buildPipelineGraph`.
     */
    | 'brollLane';

/** Data the React Flow runtime hands to the custom node component. The node
 *  reads its own slot off `state`; scene nodes also use `sceneIndex` to
 *  look up the right entry in `state.scenes`. */
export interface PipelineNodeData {
    kind: PipelineNodeKind;
    state: PipelineState;
    sceneIndex?: number;
}

export interface BuildGraphResult {
    nodes: Node<PipelineNodeData>[];
    edges: Edge[];
    nodeSizeOverrides: Record<string, { width: number; height: number }>;
}

/**
 * Sizing per-node-kind. Final Cut is the hero. Scene nodes are intentionally
 * compact — there can be 8–30 of them ranked vertically off Storyboard, and
 * full-size cards would tank the dagre layout. Exported so `BaseNodeShell`
 * (and `SceneNode`) can pin each node's DOM width to the same value dagre is
 * laying out for — without that constraint, embedded media or long unwrapped
 * text causes the rendered node to balloon and overlap its neighbors.
 */
export const NODE_SIZES: Record<PipelineNodeKind, { width: number; height: number }> = {
    pitch: { width: 280, height: 140 },
    // Slightly taller than the other linear nodes so the source list +
    // optional search query fit without clipping.
    research: { width: 260, height: 160 },
    // Beats node — slightly taller to fit the beat-count summary line.
    beats: { width: 260, height: 150 },
    screenplay: { width: 260, height: 140 },
    narration: { width: 260, height: 130 },
    storyboard: { width: 280, height: 180 },
    // v3 — ShotPlanner replaces Beats+Screenplay+Storyboard. Slightly wider
    // so the audio-policy + recurring-motif summary line fits.
    shotPlanner: { width: 300, height: 180 },
    // v3 — NarrationWriter sits between ShotPlanner and Scenes.
    narrationWriter: { width: 260, height: 150 },
    filming: { width: 260, height: 140 },
    // Scenes sit in their own dagre rank each (sequential chain off
    // Storyboard), so width is the dominant cost — narrower scenes let
    // 10+ of them fit horizontally inside the viewport at fitView. Height
    // accounts for ~36px header + 16:9 thumbnail (180×9/16=101) + ~40px
    // 2-line narration + borders.
    scene: { width: 200, height: 220 },
    // Talent + Score sit on a secondary row below the scene strip (set by
    // PipelineFlow's manual positioning). Sized for: header + 2-line body +
    // optional grid / audio control underneath.
    talent: { width: 260, height: 160 },
    score: { width: 260, height: 150 },
    finalCut: { width: 480, height: 280 },
    // Sized dynamically per-run by PipelineFlow. The default here is
    // the smallest sensible footprint so dagre never reserves space for
    // a lane it doesn't actually render.
    brollLane: { width: 0, height: 0 },
};

function pushEdge(edges: Edge[], src: string, tgt: string, animated: boolean, id?: string): void {
    edges.push({
        id: id ?? `e-${src}-${tgt}`,
        source: src,
        target: tgt,
        animated,
        type: 'smoothstep',
    });
}

export function buildPipelineGraph(state: PipelineState): BuildGraphResult {
    const nodes: Node<PipelineNodeData>[] = [];
    const edges: Edge[] = [];
    const nodeSizeOverrides: Record<string, { width: number; height: number }> = {};

    const makeStageNode = (kind: PipelineNodeKind): Node<PipelineNodeData> => {
        nodeSizeOverrides[kind] = NODE_SIZES[kind];
        return {
            id: kind,
            type: kind,
            position: { x: 0, y: 0 }, // overwritten by dagre
            data: { kind, state },
        };
    };

    // ── Linear chain depends on pipelineVersion ───────────────────────────
    //
    // v2: Pitch → [Research?] → [Beats?] → Screenplay → Narration → Storyboard
    // v3: Pitch → [Research?] → ShotPlanner → NarrationWriter
    //
    // v3 hides the v2 chain entirely — ShotPlanner subsumes BeatPlanner +
    // Screenplay + Director, and NarrationWriter replaces the monolithic
    // Narration. Per-shot TTS still produces audio downstream but doesn't
    // get its own node (it's part of "filming" / scene-level work).
    const isV3 = state.pipelineVersion === 'v3';
    const slot = (k: keyof PipelineState) =>
        (state as unknown as Record<string, { state: string }>)[k]?.state;

    nodes.push(makeStageNode('pitch'));
    if (state.research) nodes.push(makeStageNode('research'));

    let prevLinear = 'pitch';
    if (state.research) {
        pushEdge(edges, prevLinear, 'research', slot('research') === 'in_production');
        prevLinear = 'research';
    }

    let upstreamOfScenes: string;
    if (isV3) {
        nodes.push(makeStageNode('shotPlanner'));
        nodes.push(makeStageNode('narrationWriter'));
        pushEdge(edges, prevLinear, 'shotPlanner', slot('shotPlanner') === 'in_production');
        pushEdge(
            edges,
            'shotPlanner',
            'narrationWriter',
            slot('narrationWriter') === 'in_production'
        );
        upstreamOfScenes = 'narrationWriter';
    } else {
        if (state.beats) nodes.push(makeStageNode('beats'));
        nodes.push(makeStageNode('screenplay'));
        nodes.push(makeStageNode('narration'));
        nodes.push(makeStageNode('storyboard'));
        if (state.beats) {
            pushEdge(edges, prevLinear, 'beats', slot('beats') === 'in_production');
            prevLinear = 'beats';
        }
        pushEdge(edges, prevLinear, 'screenplay', slot('screenplay') === 'in_production');
        pushEdge(edges, 'screenplay', 'narration', slot('narration') === 'in_production');
        pushEdge(edges, 'narration', 'storyboard', slot('storyboard') === 'in_production');
        upstreamOfScenes = 'storyboard';
    }

    // ── Branching: scene nodes if shot plan is known, else single Filming counter ──
    const useSceneNodes = state.scenes.length > 0;

    if (useSceneNodes) {
        // Sequential chain — Storyboard → Scene 0 → Scene 1 → … → Scene N → Final Cut.
        //
        // We tried the parallel-branch layout (storyboard fans out to N
        // scenes which all converge at Final Cut) — dagre stacks the scene
        // siblings vertically, but with N=10+ the column overflows the
        // viewport, fitView clamps at minZoom, and only the bottom-most
        // scene ends up visible. A sequential chain plays to dagre's
        // strength (linear LR layouts) and lets scenes spread horizontally
        // instead. The narrative is still "the storyboard's scenes get
        // filmed", just shown as a stepped flow rather than parallel
        // production.
        //
        // Use the array position `i` as the React Flow node id — guaranteed
        // unique even if the BE returns scenes with missing or duplicate
        // `shot_index` values. We pass `sceneIndex: i` so SceneNode +
        // NodeDetailSheet can do a stable array lookup; the BE-provided
        // `scene.index` is preserved on the slot itself for display
        // ("Scene 01", etc.).
        let prevId = upstreamOfScenes;
        state.scenes.forEach((scene, i) => {
            const id = `scene-${i}`;
            nodeSizeOverrides[id] = NODE_SIZES.scene;
            nodes.push({
                id,
                type: 'scene',
                position: { x: 0, y: 0 },
                data: { kind: 'scene', state, sceneIndex: i },
            });
            pushEdge(edges, prevId, id, scene.state === 'in_production', `e-${prevId}-${id}`);
            prevId = id;
        });
        nodes.push(makeStageNode('finalCut'));
        pushEdge(
            edges,
            prevId,
            'finalCut',
            slot('finalCut') === 'in_production',
            `e-${prevId}-finalCut`
        );
    } else {
        // Legacy fallback: upstream → Filming counter → Final Cut.
        // On v2 the upstream is Storyboard; on v3 it's NarrationWriter (when
        // no shot plan reached the FE for some reason, e.g. mid-planning).
        nodes.push(makeStageNode('filming'));
        nodes.push(makeStageNode('finalCut'));
        pushEdge(edges, upstreamOfScenes, 'filming', slot('filming') === 'in_production');
        pushEdge(edges, 'filming', 'finalCut', slot('finalCut') === 'in_production');
    }

    // ── Optional parallel branches: Talent + Score (Phase 3) ─────────────
    // Both branch off the upstream-of-scenes node (Storyboard on v2 /
    // NarrationWriter on v3) and converge at Final Cut, running in parallel
    // to the scene chain. Hidden when not configured. PipelineFlow positions
    // them on a secondary row beneath the scene strip.
    if (state.talent) {
        nodes.push(makeStageNode('talent'));
        pushEdge(edges, upstreamOfScenes, 'talent', state.talent.state === 'in_production');
        pushEdge(
            edges,
            'talent',
            'finalCut',
            state.talent.state === 'wrapped' && slot('finalCut') !== 'wrapped'
        );
    }
    if (state.score) {
        nodes.push(makeStageNode('score'));
        pushEdge(edges, upstreamOfScenes, 'score', state.score.state === 'in_production');
        pushEdge(
            edges,
            'score',
            'finalCut',
            state.score.state === 'wrapped' && slot('finalCut') !== 'wrapped'
        );
    }

    return { nodes, edges, nodeSizeOverrides };
}
