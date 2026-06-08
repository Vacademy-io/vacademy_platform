/**
 * Wizard Step 5 — BUILD.
 *
 * Kicks off the async build (POST /projects/{id}/builds), polls its status,
 * and shows a stage-by-stage progress panel. On AWAITING_EDIT it surfaces the
 * "Open in editor" path (P5 wires the editor load; for now it routes to the
 * project detail page where the build is listed). On FAILED it shows the
 * error + a retry.
 */
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    CheckCircle,
    CircleNotch,
    Sparkle,
    WarningCircle,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCreateBuild, useStudioBuild } from '../hooks/useStudioBuild';
import type { BuildStage } from '../services/studio-api';

interface BuildStepProps {
    apiKey: string;
    instituteId: string | undefined;
    projectId: string;
}

// Canonical build-stage order. Must match studio_orchestrator.STAGE_PIPELINE —
// COMPOSE_HTML (P6) runs between ASSEMBLE_TIMELINE and UPLOAD. A stage missing
// here makes `findIndex` return -1, which clamps the whole checklist to
// "un-started" mid-build, so keep this list complete + ordered.
const STAGE_LABELS: Array<{ id: BuildStage; label: string }> = [
    { id: 'ASSEMBLE_TIMELINE', label: 'Assembling timeline' },
    { id: 'COMPOSE_HTML', label: 'Adding overlays' },
    { id: 'ASSEMBLE_WORDS', label: 'Building captions' },
    { id: 'UPLOAD', label: 'Saving' },
    { id: 'HANDOFF', label: 'Finishing up' },
];

export function BuildStep({ apiKey, instituteId, projectId }: BuildStepProps) {
    const navigate = useNavigate();
    const [buildId, setBuildId] = useState<string | null>(null);

    const createBuild = useCreateBuild({ apiKey, instituteId, projectId });
    const build = useStudioBuild({ apiKey, buildId: buildId ?? undefined });

    const start = () => {
        createBuild.mutate(
            {},
            {
                onSuccess: (b) => setBuildId(b.id),
                onError: (e) =>
                    toast.error(e instanceof Error ? e.message : 'Could not start build.'),
            }
        );
    };

    const status = build.data?.status;
    const stage = build.data?.build_stage;
    const progress = build.data?.progress ?? 0;
    const building = status === 'PENDING' || status === 'BUILDING';
    const done = status === 'AWAITING_EDIT' || status === 'RENDERED';
    const failed = status === 'FAILED';

    const goToProject = () =>
        navigate({ to: '/vim/studio/$projectId', params: { projectId } });

    // Not started yet.
    if (!buildId) {
        return (
            <div className="space-y-6">
                <header>
                    <h2 className="text-lg font-semibold text-neutral-900">
                        Build your video
                    </h2>
                    <p className="mt-1 text-sm text-neutral-600">
                        We’ll assemble your arrangement and cuts into an editable
                        timeline. You can fine-tune everything in the editor
                        afterwards.
                    </p>
                </header>
                <div className="flex items-center justify-end border-t border-neutral-200 pt-4">
                    <button
                        type="button"
                        onClick={start}
                        disabled={createBuild.isPending}
                        className="inline-flex h-10 items-center gap-1.5 rounded-md bg-neutral-900 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:opacity-50"
                    >
                        <Sparkle weight="fill" className="size-4" />
                        {createBuild.isPending ? 'Starting…' : 'Build video'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-lg font-semibold text-neutral-900">
                    {done ? 'Your video is ready' : failed ? 'Build failed' : 'Building…'}
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                    {done
                        ? 'The timeline is assembled. Open it in the editor to refine and render.'
                        : failed
                          ? 'Something went wrong assembling the timeline.'
                          : 'Hang tight — this usually takes a few seconds.'}
                </p>
            </header>

            {/* Stage list */}
            <ol className="space-y-2">
                {STAGE_LABELS.map((s) => {
                    const reached =
                        done ||
                        STAGE_LABELS.findIndex((x) => x.id === stage) >=
                            STAGE_LABELS.findIndex((x) => x.id === s.id);
                    const active = building && stage === s.id;
                    return (
                        <li key={s.id} className="flex items-center gap-2 text-sm">
                            {done || (reached && !active) ? (
                                <CheckCircle weight="fill" className="size-4 text-emerald-600" />
                            ) : active ? (
                                <CircleNotch className="size-4 animate-spin text-indigo-600" />
                            ) : (
                                <span className="size-4 rounded-full border border-neutral-300" />
                            )}
                            <span
                                className={cn(
                                    reached || done ? 'text-neutral-900' : 'text-neutral-400'
                                )}
                            >
                                {s.label}
                            </span>
                        </li>
                    );
                })}
            </ol>

            {building && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    {/* Dynamic width = live build progress %; isolated per design-system rule. */}
                    <div
                        className="h-full bg-neutral-900 transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {failed && (
                <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                    <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
                    <span>{build.data?.error_message || 'Unknown error.'}</span>
                </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4">
                {failed && (
                    <button
                        type="button"
                        onClick={() => {
                            setBuildId(null);
                            start();
                        }}
                        className="inline-flex h-10 items-center rounded-md bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-800"
                    >
                        Retry
                    </button>
                )}
                {done && (
                    <button
                        type="button"
                        onClick={goToProject}
                        className="inline-flex h-10 items-center gap-1.5 rounded-md bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-800"
                    >
                        <CheckCircle weight="fill" className="size-4" />
                        View project
                    </button>
                )}
            </div>
        </div>
    );
}
