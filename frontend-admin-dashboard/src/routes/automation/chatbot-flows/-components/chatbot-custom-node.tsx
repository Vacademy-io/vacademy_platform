import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useChatbotFlowStore } from '../-stores/chatbot-flow-store';

interface ChatbotNodeData {
    nodeType: string;
    name: string;
    config: Record<string, unknown>;
    color: string;
    icon: string;
}

function ChatbotCustomNode({ id, data, selected }: NodeProps<ChatbotNodeData>) {
    const selectNode = useChatbotFlowStore((s) => s.selectNode);
    const removeNode = useChatbotFlowStore((s) => s.removeNode);

    return (
        <div
            onClick={() => selectNode(id)}
            className={`rounded-lg border-2 bg-white shadow-md min-w-[200px] cursor-pointer transition-all ${
                selected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
            }`}
            style={{ borderLeftColor: data.color, borderLeftWidth: '4px' }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2 rounded-t-lg"
                style={{ backgroundColor: `${data.color}15` }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-lg">{data.icon}</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {data.nodeType.replaceAll('_', ' ')}
                    </span>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        removeNode(id);
                    }}
                    className="text-gray-400 hover:text-red-500 text-xs"
                >
                    ✕
                </button>
            </div>

            {/* Body */}
            <div className="px-3 py-2">
                <p className="text-sm font-medium text-gray-800 truncate">{data.name}</p>
                {data.nodeType === 'SEND_TEMPLATE' && !!data.config.templateName && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                        📄 {data.config.templateName as string}
                    </p>
                )}
                {data.nodeType === 'DELAY' && (
                    <p className="text-xs text-gray-500 mt-1">
                        ⏱️ {data.config.delayValue as number} {(data.config.delayUnit as string)?.toLowerCase()}
                    </p>
                )}
                {data.nodeType === 'CONDITION' && (
                    <p className="text-xs text-gray-500 mt-1">
                        🔀 {((data.config.branches as unknown[]) || []).length} branches
                    </p>
                )}
                {data.nodeType === 'TRIGGER' && (
                    <p className="text-xs text-gray-500 mt-1">
                        ⚡ {((data.config.keywords as string[]) || []).join(', ') || 'Any message'}
                    </p>
                )}
                {data.nodeType === 'AI_RESPONSE' && (
                    <p className="text-xs text-gray-500 mt-1">
                        🤖 {(data.config.modelId as string)?.split('/').pop() || 'AI'}
                    </p>
                )}
            </div>

            {/* Handles */}
            {data.nodeType !== 'TRIGGER' && (
                <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />
            )}
            <Handle type="source" position={Position.Bottom} className="!w-3 !h-3" style={{ background: data.color }} />
        </div>
    );
}

export default memo(ChatbotCustomNode);
