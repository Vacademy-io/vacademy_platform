import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Warning, SkipForward, Spinner } from '@phosphor-icons/react';

interface ExecutionFlowNodeData {
    name: string;
    nodeType: string;
    executionStatus?: 'RUNNING' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'SKIPPED' | null;
    executionTimeMs?: number | null;
    hasError?: boolean;
}

const statusStyles: Record<string, { ring: string; bg: string; icon: React.ReactNode }> = {
    SUCCESS: {
        ring: 'ring-2 ring-green-500',
        bg: 'bg-green-50',
        icon: <CheckCircle size={18} weight="fill" className="text-green-600" />,
    },
    FAILED: {
        ring: 'ring-2 ring-red-500',
        bg: 'bg-red-50',
        icon: <XCircle size={18} weight="fill" className="text-red-600" />,
    },
    PARTIAL_SUCCESS: {
        ring: 'ring-2 ring-yellow-500',
        bg: 'bg-yellow-50',
        icon: <Warning size={18} weight="fill" className="text-yellow-600" />,
    },
    SKIPPED: {
        ring: 'ring-2 ring-gray-400',
        bg: 'bg-gray-50',
        icon: <SkipForward size={18} weight="fill" className="text-gray-500" />,
    },
    RUNNING: {
        ring: 'ring-2 ring-blue-500 animate-pulse',
        bg: 'bg-blue-50',
        icon: <Spinner size={18} className="text-blue-600 animate-spin" />,
    },
};

const nodeTypeColors: Record<string, string> = {
    TRIGGER: 'border-green-400',
    QUERY: 'border-cyan-400',
    TRANSFORM: 'border-amber-400',
    ACTION: 'border-blue-400',
    SEND_EMAIL: 'border-purple-400',
    SEND_WHATSAPP: 'border-emerald-400',
    HTTP_REQUEST: 'border-orange-400',
    DELAY: 'border-slate-400',
    FILTER: 'border-teal-400',
    AGGREGATE: 'border-rose-400',
    CONDITION: 'border-yellow-400',
    LOOP: 'border-violet-400',
};

function ExecutionFlowNodeInner({ data }: NodeProps<ExecutionFlowNodeData>) {
    const status = data.executionStatus;
    const statusStyle = status ? statusStyles[status] : null;
    const borderColor = nodeTypeColors[data.nodeType] ?? 'border-gray-400';

    const formatDuration = (ms: number | null | undefined) => {
        if (!ms) return null;
        if (ms < 1000) return `${Math.round(ms)}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    return (
        <div
            className={`rounded-lg border-2 ${borderColor} ${statusStyle?.bg ?? 'bg-white'} ${statusStyle?.ring ?? ''} min-w-[180px] px-3 py-2.5 shadow-sm transition-all cursor-pointer`}
        >
            <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />

            <div className="flex items-center gap-2 mb-1">
                {statusStyle?.icon}
                <span className="font-semibold text-xs truncate max-w-[140px]">{data.name}</span>
            </div>

            <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 uppercase">
                    {data.nodeType}
                </Badge>
                {data.executionTimeMs != null && (
                    <span className="text-[9px] text-muted-foreground">
                        {formatDuration(data.executionTimeMs)}
                    </span>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3" />
        </div>
    );
}

export const ExecutionFlowNode = memo(ExecutionFlowNodeInner);
