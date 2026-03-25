import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { WorkflowNode, NodeType } from '@/types/workflow/workflow-types';
import { cn } from '@/lib/utils';

interface WorkflowNodeData {
    node: WorkflowNode;
    onNodeClick: () => void;
}

const getNodeTypeColor = (type: NodeType): string => {
    const colors = {
        TRIGGER: 'border-green-500 bg-green-50 hover:bg-green-100',
        ACTION: 'border-blue-500 bg-blue-50 hover:bg-blue-100',
        DECISION: 'border-yellow-500 bg-yellow-50 hover:bg-yellow-100',
        EMAIL: 'border-purple-500 bg-purple-50 hover:bg-purple-100',
        NOTIFICATION: 'border-indigo-500 bg-indigo-50 hover:bg-indigo-100',
        DATABASE: 'border-red-500 bg-red-50 hover:bg-red-100',
        WEBHOOK: 'border-orange-500 bg-orange-50 hover:bg-orange-100',
        UNKNOWN: 'border-gray-500 bg-gray-50 hover:bg-gray-100',
    };
    return colors[type] || colors.UNKNOWN;
};

const getNodeIcon = (type: NodeType): string => {
    const icons = {
        TRIGGER: '⚡',
        ACTION: '⚙️',
        DECISION: '🔀',
        EMAIL: '📧',
        NOTIFICATION: '🔔',
        DATABASE: '💾',
        WEBHOOK: '🔗',
        UNKNOWN: '❓',
    };
    return icons[type] || icons.UNKNOWN;
};

export const WorkflowNodeComponent = memo(({ data }: NodeProps<WorkflowNodeData>) => {
    const { node, onNodeClick } = data;

    return (
        <div
            className={cn(
                'min-w-[250px] cursor-pointer rounded-lg border-2 p-4 shadow-md transition-all hover:shadow-lg',
                getNodeTypeColor(node.type)
            )}
            onClick={onNodeClick}
        >
            <Handle type="target" position={Position.Top} className="!bg-neutral-400" />

            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{getNodeIcon(node.type)}</span>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-neutral-800">{node.title}</p>
                        <p className="text-xs font-medium text-neutral-600">{node.type}</p>
                    </div>
                </div>

                {node.description && (
                    <p className="line-clamp-2 text-xs text-neutral-600">{node.description}</p>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-neutral-400" />
        </div>
    );
});

WorkflowNodeComponent.displayName = 'WorkflowNodeComponent';

