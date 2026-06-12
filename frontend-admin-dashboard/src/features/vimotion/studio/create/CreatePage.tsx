/**
 * `/vim/studio/new` — the create wizard host.
 *
 * State machine: ingest → arrangement → cuts → overlays → audio → build.
 * Once a project is created its id lives in `projectId`; subsequent steps
 * operate on that id.
 *
 * Resume (P7): `/vim/studio/new?projectId=…` skips ingest — the project is
 * fetched, handles hydrate from its asset refs, and the wizard opens at the
 * first step that isn't in `confirmed_plan` yet (all confirmed → build).
 * Re-entering a step re-plans it; confirmed choices are re-proposed, not
 * restored verbatim.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import { useVimotionApiKey } from '../../dashboard/hooks/useVimotionApiKey';
import { useCreateStudioProject, useStudioProject } from '../hooks/useStudioProjects';
import type { CreateProjectRequest, ProjectResponse } from '../services/studio-api';
import { WizardShell, type WizardStepId } from './WizardShell';
import { IngestStep } from './IngestStep';
import { ArrangementStep } from './ArrangementStep';
import { CutsStep } from './CutsStep';
import { OverlaysStep } from './OverlaysStep';
import { AudioStep } from './AudioStep';
import { BuildStep } from './BuildStep';

/** First wizard step missing from confirmed_plan (wizard order). */
function firstUnconfirmedStep(project: ProjectResponse): WizardStepId {
    const confirmed = project.confirmed_plan ?? {};
    for (const s of ['arrangement', 'cuts', 'overlays', 'audio'] as const) {
        if (!(s in confirmed)) return s;
    }
    return 'build';
}

export function CreatePage({ resumeProjectId }: { resumeProjectId?: string }) {
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

    // Resume mode — hydrate from an existing project, once.
    const resumeProject = useStudioProject({
        apiKey: apiKey.data,
        instituteId,
        projectId: resumeProjectId,
    });
    const resumedRef = useRef(false);
    useEffect(() => {
        if (resumedRef.current || !resumeProjectId || !resumeProject.data) return;
        resumedRef.current = true;
        const project = resumeProject.data;
        setProjectId(project.id);
        setImageHandles(
            new Set(
                project.source_asset_refs.filter((r) => r.kind === 'image').map((r) => r.handle)
            )
        );
        setVideoHandles(
            project.source_asset_refs.filter((r) => r.kind === 'video').map((r) => r.handle)
        );
        setStep(firstUnconfirmedStep(project));
    }, [resumeProjectId, resumeProject.data]);

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
                    project.source_asset_refs.filter((r) => r.kind === 'video').map((r) => r.handle)
                );
                setStep('arrangement');
                toast.success('Project created. Let’s arrange your clips.');
            },
            onError: (e) => {
                toast.error(e instanceof Error ? e.message : 'Could not create the project.');
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

    if (resumeProjectId && resumeProject.isError) {
        return (
            <div className="mx-auto max-w-5xl p-8">
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                    Could not load that project — it may have been deleted.
                </div>
            </div>
        );
    }

    if (resumeProjectId && !resumedRef.current) {
        return (
            <div className="mx-auto flex max-w-5xl items-center justify-center p-16">
                <p className="animate-pulse text-sm text-neutral-500">Loading your project…</p>
            </div>
        );
    }

    return (
        <WizardShell currentStep={step} onBack={step === 'ingest' ? backToDashboard : undefined}>
            {step === 'ingest' && (
                <IngestStep
                    apiKey={apiKey.data ?? ''}
                    submitting={createProject.isPending}
                    error={
                        createProject.error instanceof Error ? createProject.error.message : null
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
                    onConfirmed={() => setStep('overlays')}
                />
            )}

            {step === 'overlays' && projectId && (
                <OverlaysStep
                    apiKey={apiKey.data ?? ''}
                    instituteId={instituteId}
                    projectId={projectId}
                    onConfirmed={() => setStep('audio')}
                />
            )}

            {step === 'audio' && projectId && (
                <AudioStep
                    apiKey={apiKey.data ?? ''}
                    instituteId={instituteId}
                    projectId={projectId}
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
                step !== 'overlays' &&
                step !== 'audio' &&
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
            <h3 className="text-base font-semibold text-neutral-900">Project created ✓</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
                The <span className="font-medium capitalize">{step}</span> step is coming next. Your
                project is saved
                {projectId ? ` (id ${projectId.slice(0, 8)}…)` : ''} — you can open it any time from
                the Studio tab.
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
