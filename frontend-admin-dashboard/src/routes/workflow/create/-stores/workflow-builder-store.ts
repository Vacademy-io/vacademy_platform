import { create } from 'zustand';
import {
    Node,
    Edge,
    Connection,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    NodeChange,
    EdgeChange,
} from 'reactflow';
import { v4 as uuidv4 } from 'uuid';

export interface WorkflowBuilderState {
    nodes: Node[];
    edges: Edge[];
    selectedNodeId: string | null;
    workflowName: string;
    workflowDescription: string;
    workflowType: 'SCHEDULED' | 'EVENT_DRIVEN';
    isDirty: boolean;
    isSaving: boolean;

    // Actions
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    addNode: (type: string, name: string, position?: { x: number; y: number }) => void;
    removeNode: (nodeId: string) => void;
    selectNode: (nodeId: string | null) => void;
    updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
    updateNodeName: (nodeId: string, name: string) => void;
    setWorkflowName: (name: string) => void;
    setWorkflowDescription: (description: string) => void;
    setWorkflowType: (type: 'SCHEDULED' | 'EVENT_DRIVEN') => void;
    setIsSaving: (saving: boolean) => void;
    reset: () => void;
}

const initialState = {
    nodes: [] as Node[],
    edges: [] as Edge[],
    selectedNodeId: null as string | null,
    workflowName: '',
    workflowDescription: '',
    workflowType: 'SCHEDULED' as const,
    isDirty: false,
    isSaving: false,
};

export const useWorkflowBuilderStore = create<WorkflowBuilderState>((set, get) => ({
    ...initialState,

    setNodes: (nodes) => set({ nodes, isDirty: true }),
    setEdges: (edges) => set({ edges, isDirty: true }),

    onNodesChange: (changes) =>
        set((state) => ({
            nodes: applyNodeChanges(changes, state.nodes),
            isDirty: true,
        })),

    onEdgesChange: (changes) =>
        set((state) => ({
            edges: applyEdgeChanges(changes, state.edges),
            isDirty: true,
        })),

    onConnect: (connection) =>
        set((state) => ({
            edges: addEdge(
                {
                    ...connection,
                    id: `edge-${uuidv4()}`,
                    type: 'smoothstep',
                    animated: true,
                },
                state.edges
            ),
            isDirty: true,
        })),

    addNode: (type, name, position) => {
        const id = `node-${uuidv4()}`;
        const nodeCount = get().nodes.length;
        const newNode: Node = {
            id,
            type: 'workflowNode',
            position: position ?? {
                x: 250 + (nodeCount % 3) * 300,
                y: 100 + Math.floor(nodeCount / 3) * 200,
            },
            data: {
                name,
                nodeType: type,
                config: {},
                isStartNode: type === 'TRIGGER' && nodeCount === 0,
                isEndNode: false,
            },
        };
        set((state) => ({
            nodes: [...state.nodes, newNode],
            isDirty: true,
        }));
    },

    removeNode: (nodeId) =>
        set((state) => ({
            nodes: state.nodes.filter((n) => n.id !== nodeId),
            edges: state.edges.filter(
                (e) => e.source !== nodeId && e.target !== nodeId
            ),
            selectedNodeId:
                state.selectedNodeId === nodeId ? null : state.selectedNodeId,
            isDirty: true,
        })),

    selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

    updateNodeConfig: (nodeId, config) =>
        set((state) => ({
            nodes: state.nodes.map((n) =>
                n.id === nodeId
                    ? { ...n, data: { ...n.data, config } }
                    : n
            ),
            isDirty: true,
        })),

    updateNodeName: (nodeId, name) =>
        set((state) => ({
            nodes: state.nodes.map((n) =>
                n.id === nodeId
                    ? { ...n, data: { ...n.data, name } }
                    : n
            ),
            isDirty: true,
        })),

    setWorkflowName: (name) => set({ workflowName: name, isDirty: true }),
    setWorkflowDescription: (description) =>
        set({ workflowDescription: description, isDirty: true }),
    setWorkflowType: (type) => set({ workflowType: type, isDirty: true }),
    setIsSaving: (saving) => set({ isSaving: saving }),
    reset: () => set(initialState),
}));
