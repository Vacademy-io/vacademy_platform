/**
 * `/vim/studio/new` — the create wizard host.
 *
 * State machine (P1 wires Step 0 → project create → hand to Step 1):
 *   ingest        — IngestStep; on submit POSTs /projects, then advances
 *   arrangement   — placeholder until P2 wires the arrangement step
 *   cuts / overlays / audio — placeholders until P3 / P6 / P7
 *
 * Once a project is created its id lives in `projectId`; subsequent steps
 * operate on that id. Navigating away + back resumes from the project detail
 * page (P5), not this wizard.
 */
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import { useVimotionApiKey } from '../../dashboard/hooks/useVimotionApiKey';
import { useCreateStudioProject } from '../hooks/useStudioProjects';
import type { CreateProjectRequest } from '../services/studio-api';
import { WizardShell, type WizardStepId } from './WizardShell';
import { IngestStep } from './IngestStep';
import { ArrangementStep } from './ArrangementStep';
import { CutsStep } from './CutsStep';
import { BuildStep } from './BuildStep';

export function CreatePage() {
    const navigate = useNavigate();
    const instituteId = getInstituteId();
    const apiKey = useVimotionApiKey(instituteId);

    const [step, setStep] = useState<WizardStepId>('ingest');
    const [projectId, setProjectId] = useState<string | null>(null);
    const [imageHandles, setImageHandles] = useState<Set<string>>(new Set());
    const [videoHandles, setVideoHandles] = useState<string[]>([]);

    const createProject = useCreateStudioProject({
        apiKey: apiKey.data,
        instituteId,
    });

    const onIngestSubmit = (request: CreateProjectRequest) => {
        if (!apiKey.data) {
            toast.error('Video service not connected yet — please retry.');
            return;
        }
        createProject.mutate(request, {
            onSuccess: (project) => {
                setProjectId(project.id);
                setImageHandles(
                    new Set(
                        project.source_asset_refs
                            .filter((r) => r.kind === 'image')
                            .map((r) => r.handle)
                    )
                );
                setVideoHandles(
                    project.source_asset_refs
                        .filter((r) => r.kind === 'video')
                        .map((r) => r.handle)
                );
                setStep('arrangement');
                toast.success('Project created. Let’s arrange your clips.');
            },
            onError: (e) => {
                toast.error(
                    e instanceof Error ? e.message : 'Could not create the project.'
                );
            },
        });
    };

    const backToDashboard = () => {
        navigate({ to: '/vim/dashboard', search: { tab: 'studio' } });
    };

    if (apiKey.isError) {
        return (
            <div className="mx-auto max-w-5xl p-8">
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                    Could not connect to the video service. Please reload.
                </div>
            </div>
        );
    }

    return (
        <WizardShell
            currentStep={step}
            onBack={step === 'ingest' ? backToDashboard : undefined}
        >
            {step === 'ingest' && (
                <IngestStep
                    apiKey={apiKey.data ?? ''}
                    submitting={createProject.isPending}
                    error={
                        createProject.error instanceof Error
                            ? createProject.error.message
                            : null
                    }
                    onSubmit={onIngestSubmit}
                />
            )}

            {step === 'arrangement' && projectId && (
                <ArrangementStep
                    apiKey={apiKey.data ?? ''}
                    instituteId={instituteId}
                    projectId={projectId}
                    imageHandles={imageHandles}
                    onConfirmed={() => setStep('cuts')}
                />
            )}

            {step === 'cuts' && projectId && (
                <CutsStep
                    apiKey={apiKey.data ?? ''}
                    instituteId={instituteId}
                    projectId={projectId}
                    videoHandles={videoHandles}
                    /* P4: overlays + audio steps (P6/P7) aren't built yet, so
                       cuts advances straight to build. They'll slot in here. */
                    onConfirmed={() => setStep('build')}
                />
            )}

            {step === 'build' && projectId && (
                <BuildStep
                    apiKey={apiKey.data ?? ''}
                    instituteId={instituteId}
                    projectId={projectId}
                />
            )}

            {step !== 'ingest' &&
                step !== 'arrangement' &&
                step !== 'cuts' &&
                step !== 'build' && (
                    <UpcomingStepPlaceholder
                        step={step}
                        projectId={projectId}
                        onViewProject={() =>
                            projectId &&
                            navigate({
                                to: '/vim/studio/$projectId',
                                params: { projectId },
                            })
                        }
                    />
                )}
        </WizardShell>
    );
}

/**
 * Placeholder shown after a project is created but before P2+ wire the
 * remaining wizard steps. Confirms the project landed and offers a path to
 * the (P5) detail page.
 */
function UpcomingStepPlaceholder({
    step,
    projectId,
    onViewProject,
}: {
    step: WizardStepId;
    projectId: string | null;
    onViewProject: () => void;
}) {
    return (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center">
            <h3 className="text-base font-semibold text-neutral-900">
                Project created ✓
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
                The <span className="font-medium capitalize">{step}</span> step
                is coming next. Your project is saved
                {projectId ? ` (id ${projectId.slice(0, 8)}…)` : ''} — you can
                open it any time from the Studio tab.
            </p>
            <button
                type="button"
                onClick={onViewProject}
                disabled={!projectId}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
                View project
            </button>
        </div>
    );
}
