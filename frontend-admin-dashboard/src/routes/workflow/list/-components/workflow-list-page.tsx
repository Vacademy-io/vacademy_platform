import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getActiveWorkflowsQuery } from '@/services/workflow-service';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { WorkflowCard } from './workflow-card';
import { Workflow } from '@/types/workflow/workflow-types';
import { Input } from '@/components/ui/input';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Plus } from '@phosphor-icons/react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';

export function WorkflowListPage() {
    const { setNavHeading } = useNavHeadingStore();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const {
        data: workflows,
        isLoading,
        error,
    } = useSuspenseQuery(getActiveWorkflowsQuery(instituteDetails?.id || ''));

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState<string | null>(null);

    useEffect(() => {
        setNavHeading(
            <div className="flex w-full items-center justify-between">
                <h1 className="text-2xl font-semibold">Workflows</h1>
            </div>
        );
    }, [setNavHeading]);

    if (isLoading) {
        return <DashboardLoader />;
    }

    if (error) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
                <div className="text-center">
                    <p className="text-lg font-medium text-red-600">Failed to load workflows</p>
                    <p className="mt-2 text-sm text-neutral-500">
                        Please try refreshing the page or contact support if the problem persists.
                    </p>
                </div>
                <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
        );
    }

    // Filter workflows based on search term and selected type
    const filteredWorkflows = workflows?.filter((workflow: Workflow) => {
        const matchesSearch =
            workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            workflow.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = !selectedType || workflow.workflow_type === selectedType;
        return matchesSearch && matchesType;
    });

    // Get unique workflow types for filter
    const workflowTypes = Array.from(
        new Set(workflows?.map((w: Workflow) => w.workflow_type) || [])
    );

    const formatWorkflowType = (type: string) => {
        // Convert EVENT_DRIVEN to "Event Driven", SCHEDULED to "Scheduled", etc.
        return type
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    return (
        <div className="container mx-auto p-6">
            {/* Header Section */}
            <div className="mb-8 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-neutral-800">Active Workflows</h1>
                        <p className="mt-1 text-neutral-600">
                            {filteredWorkflows?.length || 0} workflow
                            {filteredWorkflows?.length !== 1 ? 's' : ''} found
                        </p>
                    </div>
                    <Button
                        onClick={() => {
                            // Navigate to create workflow page when implemented
                            console.log('Create workflow clicked');
                        }}
                        className="flex items-center gap-2"
                    >
                        <Plus size={20} weight="bold" />
                        Create Workflow
                    </Button>
                </div>

                {/* Search and Filter Section */}
                <div className="flex items-center gap-4">
                    <div className="relative max-w-md flex-1">
                        <MagnifyingGlass
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                            size={20}
                        />
                        <Input
                            type="text"
                            placeholder="Search workflows..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Type Filter */}
                    {workflowTypes.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-neutral-600">Filter by type:</span>
                            <div className="flex gap-2">
                                <Button
                                    variant={selectedType === null ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedType(null)}
                                >
                                    All
                                </Button>
                                {workflowTypes.map((type) => (
                                    <Button
                                        key={type}
                                        variant={selectedType === type ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setSelectedType(type)}
                                    >
                                        {formatWorkflowType(type)}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Workflows Grid */}
            {!filteredWorkflows || filteredWorkflows.length === 0 ? (
                <div className="flex h-[50vh] flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50">
                    <div className="max-w-md text-center">
                        <p className="mb-2 text-lg font-medium text-neutral-500">
                            {searchTerm || selectedType
                                ? 'No workflows found'
                                : 'No active workflows'}
                        </p>
                        <p className="text-sm text-neutral-400">
                            {searchTerm || selectedType
                                ? 'Try adjusting your search or filter criteria'
                                : 'Create your first workflow to automate your institute processes'}
                        </p>
                        {!searchTerm && !selectedType && (
                            <Button
                                onClick={() => {
                                    // Navigate to create workflow page when implemented
                                    console.log('Create workflow clicked');
                                }}
                                className="mt-4"
                            >
                                <Plus size={20} weight="bold" className="mr-2" />
                                Create Your First Workflow
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredWorkflows.map((workflow: Workflow) => (
                        <WorkflowCard key={workflow.id} workflow={workflow} />
                    ))}
                </div>
            )}
        </div>
    );
}
