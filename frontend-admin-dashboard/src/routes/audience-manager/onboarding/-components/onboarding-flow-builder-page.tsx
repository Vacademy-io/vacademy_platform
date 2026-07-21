/**
 * OnboardingFlowBuilderPage — flow detail/builder: ordered steps, reorder,
 * add/edit/delete a step, and activate the flow once it has at least one step.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    ArrowLeft,
    CheckCircle,
    DotsSixVertical,
    PencilSimple,
    Plus,
    Rocket,
    TrashSimple,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Sortable, SortableDragHandle, SortableItem } from '@/components/ui/sortable';
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
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { StepDialog } from './step-dialog';
import {
    fetchOnboardingFlow,
    fetchOnboardingSteps,
    updateOnboardingFlow,
    deleteOnboardingStep,
    reorderOnboardingSteps,
    onboardingFlowKey,
    onboardingStepsKey,
    type OnboardingStepDTO,
} from '../-services/onboarding-service';

interface OnboardingFlowBuilderPageProps {
    flowId: string;
}

export function OnboardingFlowBuilderPage({ flowId }: OnboardingFlowBuilderPageProps) {
    const setNavHeading = useNavHeadingStore((s) => s.setNavHeading);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const flowQuery = useQuery({
        queryKey: onboardingFlowKey(flowId),
        queryFn: () => fetchOnboardingFlow(flowId),
        staleTime: 30 * 1000,
    });
    const instituteId = flowQuery.data?.institute_id ?? '';

    const stepsQuery = useQuery({
        queryKey: onboardingStepsKey(flowId),
        queryFn: () => fetchOnboardingSteps(flowId),
        staleTime: 15 * 1000,
    });

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">{flowQuery.data?.name ?? 'Onboarding Flow'}</h1>);
    }, [setNavHeading, flowQuery.data?.name]);

    const [steps, setSteps] = useState<OnboardingStepDTO[]>([]);
    useEffect(() => {
        if (stepsQuery.data) setSteps(stepsQuery.data);
    }, [stepsQuery.data]);

    const [stepDialogOpen, setStepDialogOpen] = useState(false);
    const [editingStep, setEditingStep] = useState<OnboardingStepDTO | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<OnboardingStepDTO | null>(null);

    const invalidateSteps = () => {
        queryClient.invalidateQueries({ queryKey: onboardingStepsKey(flowId) });
        queryClient.invalidateQueries({ queryKey: onboardingFlowKey(flowId) });
    };

    const { mutate: reorder } = useMutation({
        mutationFn: (ordered: OnboardingStepDTO[]) =>
            reorderOnboardingSteps(
                flowId,
                ordered.map((s, index) => ({ step_id: s.id, order: index }))
            ),
        onError: () => {
            toast.error('Could not save the new order. Reverting.');
            invalidateSteps();
        },
    });

    const { mutate: removeStep, isPending: deleting } = useMutation({
        mutationFn: (stepId: string) => deleteOnboardingStep(flowId, stepId),
        onSuccess: () => {
            toast.success('Step removed');
            setDeleteTarget(null);
            invalidateSteps();
        },
        onError: () => toast.error('Could not remove the step.'),
    });

    const { mutate: activateFlow, isPending: activating } = useMutation({
        mutationFn: () => updateOnboardingFlow(flowId, { status: 'ACTIVE' }),
        onSuccess: () => {
            toast.success('Flow activated');
            invalidateSteps();
        },
        onError: () => toast.error('Could not activate the flow.'),
    });

    const handleMove = ({ activeIndex, overIndex }: { activeIndex: number; overIndex: number }) => {
        const next = [...steps];
        const [moved] = next.splice(activeIndex, 1);
        if (!moved) return;
        next.splice(overIndex, 0, moved);
        setSteps(next);
        reorder(next);
    };

    const openAddStep = () => {
        setEditingStep(null);
        setStepDialogOpen(true);
    };
    const openEditStep = (step: OnboardingStepDTO) => {
        setEditingStep(step);
        setStepDialogOpen(true);
    };

    if (flowQuery.isLoading) {
        return <div className="p-6 text-body text-neutral-500">Loading flow…</div>;
    }
    if (flowQuery.isError || !flowQuery.data) {
        return (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
                <p className="text-body text-danger-700">Couldn&apos;t load this onboarding flow.</p>
                <MyButton buttonType="secondary" scale="small" onClick={() => flowQuery.refetch()}>
                    Retry
                </MyButton>
            </div>
        );
    }

    const flow = flowQuery.data;
    const canActivate = flow.status === 'DRAFT' && steps.length > 0;

    return (
        <div className="flex flex-col gap-5 p-2">
            <button
                type="button"
                onClick={() => navigate({ to: '/audience-manager/onboarding' })}
                className="flex w-fit items-center gap-1.5 text-caption font-medium text-neutral-500 hover:text-primary-600"
            >
                <ArrowLeft size={14} /> Back to Onboarding Flows
            </button>

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-h1 font-medium text-neutral-900">{flow.name}</h1>
                        <StatusBadge status={flow.status} />
                    </div>
                    {flow.description && (
                        <p className="text-subtitle text-neutral-500">{flow.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {canActivate && (
                        <MyButton buttonType="primary" scale="medium" onClick={() => activateFlow()} disable={activating}>
                            <Rocket size={16} /> {activating ? 'Activating…' : 'Activate Flow'}
                        </MyButton>
                    )}
                    <MyButton buttonType="secondary" scale="medium" onClick={openAddStep}>
                        <Plus size={16} weight="bold" /> Add Step
                    </MyButton>
                </div>
            </div>

            {flow.status === 'DRAFT' && steps.length === 0 && (
                <div className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-caption text-warning-700">
                    Add at least one step before activating this flow.
                </div>
            )}

            {stepsQuery.isLoading ? (
                <div className="text-body text-neutral-500">Loading steps…</div>
            ) : steps.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-neutral-200 bg-white py-14 text-center shadow-sm">
                    <CheckCircle size={32} className="text-neutral-300" />
                    <h3 className="text-body font-semibold text-neutral-900">No steps yet</h3>
                    <p className="max-w-sm text-caption text-neutral-500">
                        Add the first step (e.g. an enrollment form) to start building this flow.
                    </p>
                    <MyButton buttonType="primary" scale="medium" onClick={openAddStep}>
                        <Plus size={16} weight="bold" /> Add Step
                    </MyButton>
                </div>
            ) : (
                <Sortable
                    value={steps.map((s) => ({ id: s.id }))}
                    onMove={handleMove}
                >
                    <div className="flex flex-col gap-2">
                        {steps.map((step, index) => (
                            <SortableItem key={step.id} value={step.id} asChild>
                                <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
                                    <SortableDragHandle variant="ghost" size="icon" className="cursor-grab">
                                        <DotsSixVertical size={18} />
                                    </SortableDragHandle>
                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-caption font-semibold text-primary-700">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-body font-medium text-neutral-900">
                                            {step.step_name}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            <Tag>{step.step_type}</Tag>
                                            {step.is_optional && <Tag tone="neutral">Optional</Tag>}
                                            {step.grants_student_role && <Tag tone="info">Grants STUDENT role</Tag>}
                                            {step.sends_login_credentials && <Tag tone="success">Sends credentials</Tag>}
                                        </div>
                                    </div>
                                    <MyButton
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() => openEditStep(step)}
                                    >
                                        <PencilSimple size={14} /> Edit
                                    </MyButton>
                                    <MyButton
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() => setDeleteTarget(step)}
                                    >
                                        <TrashSimple size={14} className="text-danger-500" />
                                    </MyButton>
                                </div>
                            </SortableItem>
                        ))}
                    </div>
                </Sortable>
            )}

            {instituteId && (
                <StepDialog
                    instituteId={instituteId}
                    flowId={flowId}
                    open={stepDialogOpen}
                    onOpenChange={setStepDialogOpen}
                    editingStep={editingStep}
                    nextStepOrder={steps.length}
                    onSaved={invalidateSteps}
                />
            )}

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this step?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &quot;{deleteTarget?.step_name}&quot; will be archived. Learners already on this
                            step keep their progress, but the step won&apos;t appear for anyone starting the
                            flow after this.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleting}
                            onClick={() => deleteTarget && removeStep(deleteTarget.id)}
                            className="bg-danger-600 hover:bg-danger-700"
                        >
                            {deleting ? 'Removing…' : 'Remove'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const toneClass =
        status === 'ACTIVE'
            ? 'bg-success-50 text-success-700'
            : status === 'ARCHIVED'
              ? 'bg-neutral-100 text-neutral-500'
              : 'bg-warning-50 text-warning-700';
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${toneClass}`}>
            {status === 'DRAFT' ? 'Draft' : status === 'ACTIVE' ? 'Active' : 'Archived'}
        </span>
    );
}

function Tag({ children, tone = 'primary' }: { children: ReactNode; tone?: 'primary' | 'neutral' | 'info' | 'success' }) {
    const toneClass =
        tone === 'neutral'
            ? 'bg-neutral-100 text-neutral-600'
            : tone === 'info'
              ? 'bg-info-50 text-info-600'
              : tone === 'success'
                ? 'bg-success-50 text-success-700'
                : 'bg-primary-50 text-primary-700';
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium ${toneClass}`}>
            {children}
        </span>
    );
}
