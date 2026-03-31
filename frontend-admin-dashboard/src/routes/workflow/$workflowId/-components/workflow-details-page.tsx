import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getWorkflowDiagramQuery, getActiveWorkflowsQuery } from '@/services/workflow-service';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { WorkflowDiagramSimple } from './workflow-diagram-simple';
import { ExecutionHistoryTab } from './execution-history-tab';
import { ExecutionFlowViewer } from './execution-flow-viewer';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PencilSimple } from '@phosphor-icons/react';
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
    const { setNavHeading } = useNavHeadingStore();
    const [activeTab, setActiveTab] = useState('diagram');
    const [debugExecutionId, setDebugExecutionId] = useState<string | null>(null);
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const { data: workflows } = useSuspenseQuery(
        getActiveWorkflowsQuery(instituteDetails?.id || '')
    );
    const {
        data: diagram,
        isLoading,
        error,
    } = useSuspenseQuery(getWorkflowDiagramQuery(workflowId));

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

    if (isLoading) {
        return <DashboardLoader />;
    }

    if (error) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
                <div className="text-center">
                    <p className="text-lg font-medium text-red-600">
                        Failed to load workflow diagram
                    </p>
                    <p className="mt-2 text-sm text-neutral-500">
                        {error instanceof Error ? error.message : 'An error occurred'}
                    </p>
                </div>
                <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
        );
    }

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
                        </div>
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
                    <TabsTrigger value="debug" disabled={!debugExecutionId}>
                        Debug {debugExecutionId ? '' : '(select an execution)'}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="diagram">
                    <WorkflowDiagramSimple diagram={diagram} instituteId={instituteDetails?.id} />
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
                        <ExecutionFlowViewer
                            workflowId={workflowId}
                            executionId={debugExecutionId}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-64 text-muted-foreground">
                            Select an execution from the Executions tab to debug it.
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
