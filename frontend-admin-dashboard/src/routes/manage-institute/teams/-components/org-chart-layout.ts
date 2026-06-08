import dagre from 'dagre';
import type { Node, Edge } from 'reactflow';

/**
 * Top-down auto-layout for the org chart. Positions every node so that
 * parents sit above their direct reports with consistent spacing. Called
 * once on data load — after that, users can drag cards to override.
 *
 * Width/height must match the rendered PersonFlowNode dimensions
 * (240 × 88) for the connectors to land in the right spot.
 */
const NODE_WIDTH = 240;
const NODE_HEIGHT = 88;

export function layoutTopDown(nodes: Node[], edges: Edge[]): Node[] {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: 'TB',
        nodesep: 60,
        ranksep: 70,
        marginx: 24,
        marginy: 24,
    });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
    edges.forEach((e) => g.setEdge(e.source, e.target));

    dagre.layout(g);

    return nodes.map((n) => {
        const { x, y } = g.node(n.id);
        return {
            ...n,
            // dagre returns the centre point; react-flow positions by top-left.
            position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
        };
    });
}
