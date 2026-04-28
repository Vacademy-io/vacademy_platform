import { useSuspenseQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getWorkflowDiagramQuery, getActiveWorkflowsQuery, deleteWorkflow, triggerWorkflowNow } from '@/services/workflow-service';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { WorkflowDiagramSimple } from './workflow-diagram-simple';
import { ExecutionHistoryTab } from './execution-history-tab';
import { ExecutionFlowViewer } from './execution-flow-viewer';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PencilSimple, Trash, Eye, Play, Warning } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, Clock } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
    const [showRunConfirm, setShowRunConfirm] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [runResult, setRunResult] = useState<{ ok: boolean; message: string } | null>(null);
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
                                className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                disabled={isRunning}
                                onClick={() => {
                                    setRunResult(null);
                                    setShowRunConfirm(true);
                                }}
                            >
                                <Play size={14} weight="fill" />
                                {isRunning ? 'Running...' : 'Run now'}
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

                        {/* Run-now result toast */}
                        {runResult && (
                            <div
                                className={`mt-3 rounded-lg border p-3 text-xs ${
                                    runResult.ok
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                        : 'border-red-200 bg-red-50 text-red-800'
                                }`}
                            >
                                {runResult.message}
                                <button
                                    type="button"
                                    className="ml-3 underline opacity-70 hover:opacity-100"
                                    onClick={() => setRunResult(null)}
                                >
                                    Dismiss
                                </button>
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

            {/* Run-now confirmation modal */}
            <AlertDialog open={showRunConfirm} onOpenChange={setShowRunConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Warning size={20} className="text-emerald-600" weight="fill" />
                            Trigger workflow now?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 text-sm text-neutral-600">
                                <p>
                                    This will run <span className="font-semibold text-neutral-800">{workflow.name}</span> immediately in{' '}
                                    <span className="font-semibold text-neutral-800">production mode</span>.
                                </p>
                                <ul className="list-disc pl-4 space-y-1 text-neutral-500">
                                    <li>Real emails will be sent to all matching recipients.</li>
                                    <li>This cannot be undone once started.</li>
                                    <li>Use this only when you intentionally want to fire the workflow outside its schedule.</li>
                                </ul>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRunning}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isRunning}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={async () => {
                                setIsRunning(true);
                                try {
                                    const result = await triggerWorkflowNow(workflowId);
                                    setRunResult({
                                        ok: true,
                                        message: `Triggered successfully. Engine status: ${(result?.status as string) ?? 'completed'}.`,
                                    });
                                } catch (err) {
                                    const msg = err instanceof Error ? err.message : 'Unknown error';
                                    setRunResult({ ok: false, message: `Failed to trigger: ${msg}` });
                                } finally {
                                    setIsRunning(false);
                                    setShowRunConfirm(false);
                                }
                            }}
                        >
                            {isRunning ? 'Triggering...' : 'Yes, run now'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete / deactivate confirmation modal */}
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Warning size={20} className="text-red-600" weight="fill" />
                            Deactivate this workflow?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 text-sm text-neutral-600">
                                <p>
                                    <span className="font-semibold text-neutral-800">{workflow.name}</span> will stop running immediately.
                                </p>
                                <ul className="list-disc pl-4 space-y-1 text-neutral-500">
                                    <li>No new executions will be triggered after this.</li>
                                    <li>All past execution history will be preserved.</li>
                                    <li>Contact your administrator to reactivate it.</li>
                                </ul>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
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
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
