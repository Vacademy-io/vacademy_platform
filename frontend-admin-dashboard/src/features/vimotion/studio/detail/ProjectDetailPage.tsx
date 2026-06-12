/**
 * `/vim/studio/$projectId` — project detail page.
 *
 * P1: header (name, status, asset handles, prompt) + a builds section that's
 * empty until P4 lands the build executor. "Re-plan" + per-build editor links
 * land in P4/P5. For now this confirms the project persisted and shows what
 * the user configured.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    CheckCircle,
    CircleNotch,
    DownloadSimple,
    FilmStrip,
    Image as ImageIcon,
    PencilSimple,
    Sparkle,
    StackSimple,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getInstituteId } from '@/constants/helper';
import { useVimotionApiKey } from '../../dashboard/hooks/useVimotionApiKey';
import { useStudioProject } from '../hooks/useStudioProjects';
import {
    getStudioBuild,
    publishStudioBuild,
    renderStudioBuild,
    type BuildSummary,
    type ProjectResponse,
    type ProjectStatus,
    type TargetAspect,
} from '../services/studio-api';

const STATUS_LABEL: Record<ProjectStatus, string> = {
    DRAFT: 'Draft',
    PLANNING: 'Planning',
    READY_TO_BUILD: 'Ready to build',
    BUILDING: 'Building',
    PUBLISHED: 'Published',
    ARCHIVED: 'Archived',
};

/** True when some wizard step hasn't been confirmed yet (resume-able).
 *  Mirrors CreatePage.firstUnconfirmedStep's key check. */
function hasUnconfirmedStep(project: ProjectResponse): boolean {
    const confirmed = project.confirmed_plan ?? {};
    return ['arrangement', 'cuts', 'overlays', 'audio'].some((s) => !(s in confirmed));
}

/**
 * A render the user just kicked off from this page. Render submission does
 * NOT change the build's status server-side (it stays AWAITING_EDIT or
 * RENDERED), so the detail query's PENDING|BUILDING polling never engages —
 * we track in-flight renders locally and poll the build until it resolves.
 */
interface RenderFlight {
    /** Worker job id — on success the backend stamps it into
     *  extra_metadata.render_job_id alongside s3_urls.video. */
    jobId: string;
    /** error_message snapshot at submit time. Failure is signalled by a *new*
     *  '[RENDER] …' message (the backend never clears old ones), so a stale
     *  message from a previous attempt must not re-trip immediately. */
    priorError: string | null;
}

export function ProjectDetailPage({ projectId }: { projectId: string }) {
    const navigate = useNavigate();
    const qc = useQueryClient();
    const instituteId = getInstituteId();
    const apiKey = useVimotionApiKey(instituteId);

    const projectQuery = useStudioProject({
        apiKey: apiKey.data,
        instituteId,
        projectId,
    });

    // Renders in flight (keyed by build id) + the inline error from the most
    // recent failed attempt per build. The Render button doubles as retry.
    const [renderFlights, setRenderFlights] = useState<Record<string, RenderFlight>>({});
    const [renderErrors, setRenderErrors] = useState<Record<string, string>>({});

    const handleRenderStart = useCallback((buildId: string, flight: RenderFlight) => {
        setRenderErrors((prev) => {
            if (!(buildId in prev)) return prev;
            const next = { ...prev };
            delete next[buildId];
            return next;
        });
        setRenderFlights((prev) => ({ ...prev, [buildId]: flight }));
    }, []);

    // Poll while any render is in flight: every 5s fetch each in-flight build
    // (the full record carries error_message; the list summaries don't) and
    // refresh the detail query so row status/MP4 affordances update. Success =
    // our job id landed in extra_metadata.render_job_id (set together with
    // s3_urls.video → has_video); failure = a new '[RENDER] …' error_message
    // (the build returns to AWAITING_EDIT, so it stays renderable).
    useEffect(() => {
        const key = apiKey.data;
        if (!key || Object.keys(renderFlights).length === 0) return;
        let cancelled = false;
        const tick = async () => {
            for (const [buildId, flight] of Object.entries(renderFlights)) {
                try {
                    const full = await getStudioBuild(key, buildId);
                    if (cancelled) return;
                    const extra = full.extra_metadata as { render_job_id?: string } | undefined;
                    const hasVideo = Boolean(
                        (full.s3_urls as Record<string, unknown> | undefined)?.video
                    );
                    if (extra?.render_job_id === flight.jobId && hasVideo) {
                        setRenderFlights((prev) => {
                            const next = { ...prev };
                            delete next[buildId];
                            return next;
                        });
                        toast.success(
                            `${full.name || `Build v${full.version}`} rendered — MP4 ready.`
                        );
                    } else if (
                        full.error_message?.startsWith('[RENDER]') &&
                        full.error_message !== flight.priorError
                    ) {
                        const message = full.error_message;
                        setRenderFlights((prev) => {
                            const next = { ...prev };
                            delete next[buildId];
                            return next;
                        });
                        setRenderErrors((prev) => ({ ...prev, [buildId]: message }));
                    }
                } catch {
                    // network blip — keep polling
                }
            }
            if (!cancelled) {
                qc.invalidateQueries({
                    queryKey: ['studio-project', instituteId, projectId],
                });
            }
        };
        const timer = window.setInterval(() => void tick(), 5_000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [renderFlights, apiKey.data, instituteId, projectId, qc]);

    const backToStudio = () => navigate({ to: '/vim/dashboard', search: { tab: 'studio' } });

    if (projectQuery.isLoading || apiKey.isLoading) {
        return (
            <div className="mx-auto max-w-4xl space-y-4 p-6">
                <div className="h-8 w-48 animate-pulse rounded bg-neutral-100" />
                <div className="h-32 animate-pulse rounded-lg bg-neutral-100" />
            </div>
        );
    }

    if (projectQuery.isError || !projectQuery.data) {
        return (
            <div className="mx-auto max-w-4xl p-6">
                <button
                    type="button"
                    onClick={backToStudio}
                    className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
                >
                    <ArrowLeft className="size-4" /> Back to Studio
                </button>
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                    {projectQuery.error instanceof Error
                        ? projectQuery.error.message
                        : 'Could not load this project.'}
                </div>
            </div>
        );
    }

    const project = projectQuery.data;

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            <button
                type="button"
                onClick={backToStudio}
                className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
            >
                <ArrowLeft className="size-4" /> Back to Studio
            </button>

            {/* Header */}
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="flex items-center gap-2 text-xl font-semibold text-neutral-900">
                        <StackSimple weight="duotone" className="size-5 text-neutral-500" />
                        {project.name || 'Untitled project'}
                    </h1>
                    {project.target_aspect && (
                        <p className="mt-1 text-sm text-neutral-500">
                            {project.target_aspect}
                            {project.target_duration_s ? ` · ~${project.target_duration_s}s` : ''}
                        </p>
                    )}
                </div>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                    {STATUS_LABEL[project.status]}
                </span>
            </header>

            {/* Prompt */}
            {project.user_prompt && (
                <section className="rounded-lg border border-neutral-200 bg-white p-4">
                    <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Prompt
                    </h2>
                    <p className="whitespace-pre-wrap text-sm text-neutral-800">
                        {project.user_prompt}
                    </p>
                </section>
            )}

            {/* Assets */}
            <section className="rounded-lg border border-neutral-200 bg-white p-4">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Assets ({project.source_asset_refs.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                    {project.source_asset_refs.map((ref) => (
                        <span
                            key={ref.asset_id}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700'
                            )}
                        >
                            {ref.kind === 'image' ? (
                                <ImageIcon weight="duotone" className="size-3.5 text-neutral-500" />
                            ) : (
                                <FilmStrip weight="duotone" className="size-3.5 text-neutral-500" />
                            )}
                            <span className="font-mono font-medium text-neutral-900">
                                {ref.handle}
                            </span>
                        </span>
                    ))}
                </div>
            </section>

            {/* Builds */}
            <section className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Builds ({project.builds.length})
                    </h2>
                    {/* Resume whenever a wizard step is still unconfirmed — not
                        just on zero builds (every pre-P7 project lacks 'audio'). */}
                    {hasUnconfirmedStep(project) && project.builds.length > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                navigate({
                                    to: '/vim/studio/new',
                                    search: { projectId: project.id },
                                })
                            }
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 text-caption font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                        >
                            <Sparkle weight="bold" className="size-3.5" /> Resume planning
                        </button>
                    )}
                </div>
                {project.builds.length === 0 ? (
                    <div className="space-y-3">
                        <p className="text-sm text-neutral-500">
                            No builds yet. Once you finish the wizard and build a version, it’ll
                            appear here — ready to open in the editor.
                        </p>
                        <button
                            type="button"
                            onClick={() =>
                                navigate({
                                    to: '/vim/studio/new',
                                    search: { projectId: project.id },
                                })
                            }
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-neutral-900 px-3 text-caption font-medium text-white transition-colors hover:bg-neutral-800"
                        >
                            <Sparkle weight="bold" className="size-3.5" /> Resume planning
                        </button>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {project.builds.map((b) => (
                            <BuildRow
                                key={b.id}
                                build={b}
                                apiKey={apiKey.data}
                                instituteId={instituteId}
                                projectId={projectId}
                                aspect={project.target_aspect}
                                rendering={b.id in renderFlights}
                                renderError={renderErrors[b.id]}
                                onRenderStart={handleRenderStart}
                            />
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Per-build row with actions
// ---------------------------------------------------------------------------

const BUILD_STATUS_CLS: Record<string, string> = {
    PENDING: 'bg-neutral-100 text-neutral-600',
    BUILDING: 'bg-indigo-50 text-indigo-700',
    AWAITING_EDIT: 'bg-emerald-50 text-emerald-700',
    RENDERED: 'bg-emerald-50 text-emerald-700',
    FAILED: 'bg-rose-50 text-rose-700',
};

function BuildRow({
    build,
    apiKey,
    instituteId,
    projectId,
    aspect,
    rendering,
    renderError,
    onRenderStart,
}: {
    build: BuildSummary;
    apiKey: string | undefined;
    instituteId: string | undefined;
    projectId: string;
    aspect?: TargetAspect | null;
    rendering: boolean;
    renderError?: string;
    onRenderStart: (buildId: string, flight: RenderFlight) => void;
}) {
    const navigate = useNavigate();
    const qc = useQueryClient();
    const [busy, setBusy] = useState<null | 'open' | 'publish' | 'render'>(null);

    const ready = build.status === 'AWAITING_EDIT' || build.status === 'RENDERED';
    const orientation = aspect === '9:16' ? 'portrait' : 'landscape';

    // The list summaries don't carry error_message — fetch the full record
    // once for FAILED rows so the user can see *why* the build died.
    const failedDetail = useQuery({
        queryKey: ['studio-build-error', build.id, apiKey],
        enabled: !!apiKey && build.status === 'FAILED',
        staleTime: 60_000,
        queryFn: () => getStudioBuild(apiKey as string, build.id),
    });
    const rawError =
        renderError ??
        (build.status === 'FAILED' ? failedDetail.data?.error_message ?? null : null);
    // "[RENDER]"/"[STAGE]" prefixes are routing markers, not user copy.
    const inlineError = rawError?.replace(/^\[[A-Z_]+\]\s*/, '') ?? null;

    const openInEditor = async () => {
        if (!apiKey) return;
        setBusy('open');
        try {
            const full = await getStudioBuild(apiKey, build.id);
            const s3 = (full.s3_urls as Record<string, string>) ?? {};
            const timelineUrl = s3.timeline;
            if (!timelineUrl) {
                toast.error('This build has no timeline yet.');
                return;
            }
            navigate({
                to: '/vim/edit/$videoId',
                params: { videoId: build.id },
                search: {
                    kind: 'studio',
                    htmlUrl: timelineUrl,
                    apiKey,
                    orientation,
                    audioUrl: undefined,
                    // P6b: captions words track (present when captions were
                    // enabled at build) → editor previews them.
                    wordsUrl: s3.words ?? undefined,
                    avatarUrl: undefined,
                    // Back from the editor returns here (the project page) —
                    // build ids don't resolve in the dashboard production view.
                    projectId,
                    focusTime: undefined,
                },
            });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not open the editor.');
        } finally {
            setBusy(null);
        }
    };

    const publish = async () => {
        if (!apiKey) return;
        setBusy('publish');
        try {
            await publishStudioBuild(apiKey, build.id);
            qc.invalidateQueries({ queryKey: ['studio-project', instituteId, projectId] });
            toast.success(`Published ${build.name || `Build v${build.version}`}.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Publish failed.');
        } finally {
            setBusy(null);
        }
    };

    const render = async () => {
        if (!apiKey) return;
        setBusy('render');
        try {
            // Snapshot error_message first — failure detection is "a *new*
            // [RENDER] message", and the backend never clears the old one.
            const before = await getStudioBuild(apiKey, build.id);
            const result = await renderStudioBuild(apiKey, build.id, {});
            onRenderStart(build.id, {
                jobId: result.job_id,
                priorError: before.error_message ?? null,
            });
            toast.success('Render started — it’ll appear here when ready.');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Render failed.');
        } finally {
            setBusy(null);
        }
    };

    return (
        <li className="rounded-md border border-neutral-200 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-neutral-900">
                        {build.name || `Build v${build.version}`}
                    </span>
                    {build.is_published && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-caption font-medium text-emerald-700">
                            <CheckCircle weight="fill" className="size-3" /> Published
                        </span>
                    )}
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-caption font-medium',
                            BUILD_STATUS_CLS[build.status] ?? 'bg-neutral-100 text-neutral-600'
                        )}
                    >
                        {build.status.toLowerCase().replace('_', ' ')}
                    </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    {ready && (
                        <RowButton
                            onClick={openInEditor}
                            busy={busy === 'open'}
                            icon={PencilSimple}
                        >
                            Edit
                        </RowButton>
                    )}
                    {ready && !rendering && (
                        <RowButton onClick={render} busy={busy === 'render'} icon={Sparkle}>
                            Render
                        </RowButton>
                    )}
                    {rendering && (
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 text-caption font-medium text-indigo-700">
                            <CircleNotch className="size-3.5 animate-spin" /> Rendering…
                        </span>
                    )}
                    {build.has_video && (
                        <a
                            href={`/vim/studio/${projectId}`}
                            onClick={(e) => {
                                e.preventDefault();
                                void openVideo(apiKey, build.id);
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-neutral-100 px-2.5 text-caption font-medium text-neutral-700 hover:bg-neutral-200"
                        >
                            <DownloadSimple className="size-3.5" /> MP4
                        </a>
                    )}
                    {ready && !build.is_published && (
                        <RowButton onClick={publish} busy={busy === 'publish'} icon={CheckCircle}>
                            Publish
                        </RowButton>
                    )}
                </div>
            </div>
            {inlineError && <p className="mt-1.5 text-caption text-rose-600">{inlineError}</p>}
        </li>
    );
}

async function openVideo(apiKey: string | undefined, buildId: string) {
    if (!apiKey) return;
    try {
        const full = await getStudioBuild(apiKey, buildId);
        const url = (full.s3_urls as Record<string, string>)?.video;
        if (url) window.open(url, '_blank', 'noopener');
        else toast.error('No rendered MP4 yet.');
    } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not fetch the video.');
    }
}

function RowButton({
    onClick,
    busy,
    icon: Icon,
    children,
}: {
    onClick: () => void;
    busy: boolean;
    icon: typeof CheckCircle;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-neutral-100 px-2.5 text-caption font-medium text-neutral-700 transition-colors hover:bg-neutral-200 disabled:opacity-50"
        >
            <Icon weight="bold" className="size-3.5" />
            {busy ? '…' : children}
        </button>
    );
}
