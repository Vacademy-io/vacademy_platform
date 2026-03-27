import { useCallback } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useChatbotFlowStore } from '../-stores/chatbot-flow-store';
import ChatbotCustomNode from './chatbot-custom-node';
import ChatbotCustomEdge from './chatbot-custom-edge';
import { NodePalette } from './node-palette';
import { NodeConfigPanel } from './node-config-panel';
import { updateChatbotFlow, createChatbotFlow, activateChatbotFlow, deactivateChatbotFlow } from '../-services/chatbot-flow-api';
import { toast } from 'sonner';

const nodeTypes = { chatbotNode: ChatbotCustomNode };
const edgeTypes = { chatbotEdge: ChatbotCustomEdge };

function FlowBuilderInner() {
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        flowId,
        flowName,
        flowStatus,
        channelType,
        isDirty,
        isSaving,
        setFlowName,
        setChannelType,
        toDTO,
        loadFlow,
        setIsSaving,
        selectNode,
    } = useChatbotFlowStore();

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        try {
            const dto = toDTO();
            let saved;
            if (flowId) {
                saved = await updateChatbotFlow(flowId, dto);
            } else {
                saved = await createChatbotFlow(dto);
            }
            loadFlow(saved);
            toast.success('Flow saved successfully');
        } catch (err: unknown) {
            // Extract backend error message if available (axios error)
            const axiosErr = err as { response?: { data?: { message?: string } } };
            const backendMsg = axiosErr?.response?.data?.message;
            if (backendMsg?.includes('ACTIVE')) {
                toast.error('Cannot save an active flow. Deactivate it first, then save.');
            } else {
                toast.error(backendMsg || 'Failed to save flow');
            }
            console.error(err);
            throw err; // Re-throw so handleActivate's catch works
        } finally {
            setIsSaving(false);
        }
    }, [flowId, toDTO, loadFlow, setIsSaving]);

    const handleActivate = useCallback(async () => {
        if (!flowId) {
            toast.error('Save the flow first');
            return;
        }
        try {
            if (isDirty) {
                try { await handleSave(); } catch { return; }
            }
            const result = flowStatus === 'ACTIVE'
                ? await deactivateChatbotFlow(flowId)
                : await activateChatbotFlow(flowId);
            loadFlow(result);
            toast.success(result.status === 'ACTIVE' ? 'Flow activated' : 'Flow deactivated');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Validation failed';
            toast.error(msg);
        }
    }, [flowId, flowStatus, isDirty, handleSave, loadFlow]);

    const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
        selectNode(node.id);
    }, [selectNode]);

    const onPaneClick = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={flowName}
                        onChange={(e) => setFlowName(e.target.value)}
                        className="text-lg font-semibold border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1"
                    />
                    <select
                        value={channelType}
                        onChange={(e) => setChannelType(e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                    >
                        <option value="WHATSAPP_COMBOT">COMBOT</option>
                        <option value="WHATSAPP_META">Meta Direct</option>
                        <option value="WHATSAPP_WATI">WATI</option>
                        <option value="WHATSAPP">All Providers</option>
                    </select>
                    <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            flowStatus === 'ACTIVE'
                                ? 'bg-green-100 text-green-700'
                                : flowStatus === 'INACTIVE'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-600'
                        }`}
                    >
                        {flowStatus}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : isDirty ? 'Save *' : 'Save'}
                    </button>
                    <button
                        onClick={handleActivate}
                        className={`px-3 py-1.5 text-sm rounded-md ${
                            flowStatus === 'ACTIVE'
                                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                    >
                        {flowStatus === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            </div>

            {/* 3-panel layout */}
            <div className="flex flex-1 overflow-hidden">
                <NodePalette />

                <div className="flex-1">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        defaultEdgeOptions={{ type: 'chatbotEdge', animated: true }}
                        fitView
                        deleteKeyCode="Delete"
                    >
                        <Background />
                        <Controls />
                        <MiniMap
                            nodeColor={(n) => n.data?.color || '#6b7280'}
                            maskColor="rgb(240, 240, 240, 0.7)"
                        />
                    </ReactFlow>
                </div>

                <NodeConfigPanel />
            </div>
        </div>
    );
}

export function FlowBuilder() {
    return (
        <ReactFlowProvider>
            <FlowBuilderInner />
        </ReactFlowProvider>
    );
}
