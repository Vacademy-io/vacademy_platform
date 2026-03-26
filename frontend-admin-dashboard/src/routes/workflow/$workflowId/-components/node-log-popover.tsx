import { Badge } from '@/components/ui/badge';
import { WorkflowExecutionLogDTO } from '@/types/workflow/workflow-types';

interface Props {
    log: WorkflowExecutionLogDTO | null;
    onClose: () => void;
}

const statusColor: Record<string, string> = {
    SUCCESS: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    PARTIAL_SUCCESS: 'bg-yellow-100 text-yellow-800',
    SKIPPED: 'bg-gray-100 text-gray-600',
    RUNNING: 'bg-blue-100 text-blue-800',
};

export function NodeLogPopover({ log, onClose }: Props) {
    if (!log) return null;

    return (
        <div className="absolute z-50 bg-white border rounded-lg shadow-lg p-4 w-80 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">{log.node_type}</Badge>
                    <Badge className={`${statusColor[log.status] ?? ''} text-[10px]`}>{log.status}</Badge>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">
                    Close
                </button>
            </div>

            <div className="space-y-2 text-xs">
                {log.execution_time_ms != null && (
                    <div>
                        <span className="text-muted-foreground">Duration: </span>
                        <span className="font-medium">
                            {log.execution_time_ms < 1000
                                ? `${Math.round(log.execution_time_ms)}ms`
                                : `${(log.execution_time_ms / 1000).toFixed(1)}s`}
                        </span>
                    </div>
                )}

                {log.started_at && (
                    <div>
                        <span className="text-muted-foreground">Started: </span>
                        {new Date(log.started_at).toLocaleString()}
                    </div>
                )}

                {log.error_message && (
                    <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700">
                        <div className="font-medium">Error:</div>
                        {log.error_message}
                        {log.error_type && (
                            <Badge variant="outline" className="mt-1 text-[9px]">{log.error_type}</Badge>
                        )}
                    </div>
                )}

                {log.details && Object.keys(log.details).length > 0 && (
                    <div>
                        <div className="text-muted-foreground font-medium mb-1">Details:</div>
                        <pre className="bg-muted rounded p-2 text-[10px] overflow-auto max-h-32 whitespace-pre-wrap">
                            {JSON.stringify(log.details, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
