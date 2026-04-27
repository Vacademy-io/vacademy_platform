import { useSuspenseQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getWorkflowDiagramQuery, getActiveWorkflowsQuery, deleteWorkflow } from '@/services/workflow-service';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { WorkflowDiagramSimple } from './workflow-diagram-simple';
import { ExecutionHistoryTab } from './execution-history-tab';
import { ExecutionFlowViewer } from './execution-flow-viewer';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PencilSimple, Trash, Eye } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, Clock } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';

interface WorkflowDetailsPageProps {
    workflowId: string;
}
export function WorkflowDetailsPage({ workflowId }: WorkflowDetailsPageProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { setNavHeading } = useNavHeadingStore();
    const [activeTab, setActiveTab] = useState('diagram');
    const [debugExecutionId, setDebugExecutionId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const { data: workflows } = useSuspenseQuery(
        getActiveWorkflowsQuery(instituteDetails?.id || '')
    );
    const {
        data: diagram,
        isLoading: isDiagramLoading,
        error: diagramError,
    } = useQuery(getWorkflowDiagramQuery(workflowId));

    // Find the current workflow
    const workflow = workflows?.find((w) => w.id === workflowId);

    const formatWorkflowType = (type: string) => {
        return type
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return formatDistanceToNow(date, { addSuffix: true });
        } catch (error) {
            return 'Unknown';
        }
    };

    useEffect(() => {
        setNavHeading(
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate({ to: '/workflow/list' })}
                    className="flex items-center gap-2"
                >
                    <ArrowLeft size={20} />
                    Back to Workflows
                </Button>
            </div>
        );
    }, [setNavHeading, navigate]);

    if (!workflow) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
                <div className="text-center">
                    <p className="text-lg font-medium text-neutral-600">Workflow not found</p>
                    <p className="mt-2 text-sm text-neutral-500">
                        The workflow you&apos;re looking for doesn&apos;t exist or has been removed.
                    </p>
                </div>
                <Button onClick={() => navigate({ to: '/workflow/list' })}>
                    Back to Workflows
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            {/* Workflow Header */}
            <div className="mb-8 rounded-lg border border-neutral-200 bg-white p-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-neutral-800">{workflow.name}</h1>
                            <Badge
                                variant={workflow.status === 'ACTIVE' ? 'default' : 'secondary'}
                                className="bg-green-100 text-green-800 hover:bg-green-100"
                            >
                                {workflow.status}
                            </Badge>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => navigate({ to: `/workflow/${workflowId}/edit` })}
                            >
                                <PencilSimple size={14} />
                                Edit
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                <Trash size={14} />
                                Delete
                            </Button>
                        </div>

                        {/* Delete confirmation */}
                        {showDeleteConfirm && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
                                <p className="text-sm font-medium text-red-800">
                                    Are you sure you want to deactivate this workflow?
                                </p>
                                <p className="mt-1 text-xs text-red-600">
                                    This workflow will stop running immediately. All past execution history will be preserved. You can contact your administrator to reactivate it if needed.
                                </p>
                                <div className="mt-3 flex gap-2">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={isDeleting}
                                        onClick={async () => {
                                            setIsDeleting(true);
                                            try {
                                                await deleteWorkflow(workflowId);
                                                await queryClient.invalidateQueries({
                                                    queryKey: ['GET_ACTIVE_WORKFLOWS_WITH_SCHEDULES'],
                                                    refetchType: 'all',
                                                });
                                                navigate({ to: '/workflow/list' });
                                            } catch (err) {
                                                console.error('Failed to delete workflow:', err);
                                                setIsDeleting(false);
                                                setShowDeleteConfirm(false);
                                            }
                                        }}
                                    >
                                        {isDeleting ? 'Deactivating...' : 'Yes, deactivate'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowDeleteConfirm(false)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}
                        <p className="mt-2 text-neutral-600">{workflow.description}</p>

                        <div className="mt-4 flex flex-wrap items-center gap-6">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-neutral-500">Type:</span>
                                <Badge variant="outline" className="font-medium text-neutral-700">
                                    {formatWorkflowType(workflow.workflow_type)}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-neutral-500">
                                <Calendar size={16} weight="duotone" />
                                <span>Created {formatDate(workflow.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-neutral-500">
                                <Clock size={16} weight="duotone" />
                                <span>Updated {formatDate(workflow.updated_at)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs: Diagram / Executions / Debug */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                    <TabsTrigger value="diagram">Diagram</TabsTrigger>
                    <TabsTrigger value="executions">Executions</TabsTrigger>
                    <TabsTrigger value="debug">
                        Debug
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="diagram">
                    {isDiagramLoading ? (
                        <div className="flex items-center justify-center py-12 text-sm text-gray-400">Loading diagram...</div>
                    ) : diagramError ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2">
                            <p className="text-sm text-red-500">Failed to load diagram</p>
                            <p className="text-xs text-gray-400">{diagramError instanceof Error ? diagramError.message : 'Unknown error'}</p>
                        </div>
                    ) : diagram ? (
                        <WorkflowDiagramSimple diagram={diagram} instituteId={instituteDetails?.id} />
                    ) : (
                        <div className="flex items-center justify-center py-12 text-sm text-gray-400">No diagram data available</div>
                    )}
                </TabsContent>

                <TabsContent value="executions">
                    <ExecutionHistoryTab
                        workflowId={workflowId}
                        instituteId={instituteDetails?.id || ''}
                        onViewOnDiagram={(executionId) => {
                            setDebugExecutionId(executionId);
                            setActiveTab('debug');
                        }}
                    />
                </TabsContent>

                <TabsContent value="debug">
                    {debugExecutionId ? (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-gray-500">
                                    Debugging execution: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{debugExecutionId.slice(0, 8)}...</code>
                                </p>
                                <Button variant="outline" size="sm" onClick={() => setDebugExecutionId(null)}>
                                    Select different execution
                                </Button>
                            </div>
                            <ExecutionFlowViewer
                                workflowId={workflowId}
                                executionId={debugExecutionId}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <div className="rounded-full bg-gray-100 p-4">
                                <Eye size={32} className="text-gray-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-600">No execution selected</p>
                                <p className="mt-1 text-xs text-gray-400 max-w-sm">
                                    Go to the Executions tab, click on a run, then press "View on Diagram" to see the visual debug flow with node-level status and logs.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveTab('executions')}
                            >
                                Go to Executions
                            </Button>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
