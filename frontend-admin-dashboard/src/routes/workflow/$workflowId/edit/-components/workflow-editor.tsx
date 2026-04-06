import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWorkflowForEditing } from '@/services/workflow-service';
import { useWorkflowBuilderStore } from '@/routes/workflow/create/-stores/workflow-builder-store';
import { WorkflowBuilder } from '@/routes/workflow/create/-components/workflow-builder';
import { WorkflowBuilderDTO } from '@/types/workflow/workflow-types';

interface Props {
    workflowId: string;
}

export function WorkflowEditor({ workflowId }: Props) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['WORKFLOW_EDIT', workflowId],
        queryFn: () => getWorkflowForEditing(workflowId) as Promise<WorkflowBuilderDTO>,
        staleTime: 0, // Always fetch fresh for editing
    });

    const {
        setNodes,
        setEdges,
        setWorkflowName,
        setWorkflowDescription,
        setWorkflowType,
    } = useWorkflowBuilderStore();

    // Load workflow data into the builder store once fetched
    useEffect(() => {
        if (!data) return;

        setWorkflowName(data.name ?? '');
        setWorkflowDescription(data.description ?? '');
        setWorkflowType((data.workflow_type as 'SCHEDULED' | 'EVENT_DRIVEN') ?? 'SCHEDULED');

        // Convert WorkflowBuilderNodes to ReactFlow nodes
        const rfNodes = (data.nodes ?? []).map((n) => ({
            id: n.id,
            type: 'workflowNode' as const,
            position: { x: n.position_x ?? 0, y: n.position_y ?? 0 },
            data: {
                name: n.name,
                nodeType: n.node_type,
                config: n.config ?? {},
                isStartNode: n.is_start_node ?? false,
                isEndNode: n.is_end_node ?? false,
            },
        }));

        const rfEdges = (data.edges ?? []).map((e) => ({
            id: e.id,
            source: e.source_node_id,
            target: e.target_node_id,
            label: e.label ?? '',
            type: 'smoothstep' as const,
            animated: true,
        }));

        setNodes(rfNodes);
        setEdges(rfEdges);
    }, [data]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen text-muted-foreground">
                Loading workflow...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen text-red-500">
                Failed to load workflow: {error.message}
            </div>
        );
    }

    return <WorkflowBuilder />;
}
