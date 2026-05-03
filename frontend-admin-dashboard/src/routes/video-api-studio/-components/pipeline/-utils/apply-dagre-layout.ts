/**
 * Run dagre on a React Flow node + edge set and write back `position.{x,y}`
 * onto each node. Pure function — caller is responsible for re-rendering.
 *
 * Defaults to horizontal LTR layout. Caller can pass `rankdir: 'TB'` for
 * narrow-viewport stacking.
 */

import dagre from 'dagre';
import { Position, type Edge, type Node } from 'reactflow';

export interface DagreLayoutOptions {
    rankdir?: 'LR' | 'TB';
    /** Horizontal spacing between ranks (columns / rows). */
    rankSep?: number;
    /** Spacing between sibling nodes within the same rank. */
    nodeSep?: number;
    /** Default node dimensions used when a node hasn't measured itself yet. */
    defaultNodeWidth?: number;
    defaultNodeHeight?: number;
    /** Per-node overrides for size — most useful for the enlarged Final Cut. */
    nodeSizeOverrides?: Record<string, { width: number; height: number }>;
}

const DEFAULTS: Required<Omit<DagreLayoutOptions, 'nodeSizeOverrides'>> = {
    rankdir: 'LR',
    rankSep: 90,
    nodeSep: 32,
    defaultNodeWidth: 260,
    defaultNodeHeight: 120,
};

export function applyDagreLayout<NData = unknown, EData = unknown>(
    nodes: Node<NData>[],
    edges: Edge<EData>[],
    options?: DagreLayoutOptions
): Node<NData>[] {
    const opts = { ...DEFAULTS, ...options };
    const overrides = options?.nodeSizeOverrides ?? {};

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: opts.rankdir, ranksep: opts.rankSep, nodesep: opts.nodeSep });

    for (const node of nodes) {
        const size = overrides[node.id] ?? {
            width: opts.defaultNodeWidth,
            height: opts.defaultNodeHeight,
        };
        g.setNode(node.id, size);
    }
    for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
    }
    dagre.layout(g);

    return nodes.map((node) => {
        const dn = g.node(node.id);
        if (!dn) return node;
        // dagre positions are center-based; React Flow positions are top-left.
        const size = overrides[node.id] ?? {
            width: opts.defaultNodeWidth,
            height: opts.defaultNodeHeight,
        };
        return {
            ...node,
            position: {
                x: dn.x - size.width / 2,
                y: dn.y - size.height / 2,
            },
            // Tell React Flow which side the handles live on so it can route
            // edges correctly without users wiring `sourcePosition` manually.
            sourcePosition: opts.rankdir === 'LR' ? Position.Right : Position.Bottom,
            targetPosition: opts.rankdir === 'LR' ? Position.Left : Position.Top,
        };
    });
}
