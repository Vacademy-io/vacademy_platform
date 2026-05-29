/**
 * `/vim/studio/$projectId` — project detail page.
 *
 * P1: header (name, status, asset handles, prompt) + a builds section that's
 * empty until P4 lands the build executor. "Re-plan" + per-build editor links
 * land in P4/P5. For now this confirms the project persisted and shows what
 * the user configured.
 */
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    CheckCircle,
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

export function ProjectDetailPage({ projectId }: { projectId: string }) {
    const navigate = useNavigate();
    const instituteId = getInstituteId();
    const apiKey = useVimotionApiKey(instituteId);

    const projectQuery = useStudioProject({
        apiKey: apiKey.data,
        instituteId,
        projectId,
    });

    const backToStudio = () =>
        navigate({ to: '/vim/dashboard', search: { tab: 'studio' } });

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
                            {project.target_duration_s
                                ? ` · ~${project.target_duration_s}s`
                                : ''}
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
                                <ImageIcon
                                    weight="duotone"
                                    className="size-3.5 text-neutral-500"
                                />
                            ) : (
                                <FilmStrip
                                    weight="duotone"
                                    className="size-3.5 text-neutral-500"
                                />
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
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Builds ({project.builds.length})
                </h2>
                {project.builds.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                        No builds yet. Once you finish the wizard and build a
                        version, it’ll appear here — ready to open in the editor.
                    </p>
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
}: {
    build: BuildSummary;
    apiKey: string | undefined;
    instituteId: string | undefined;
    projectId: string;
    aspect?: TargetAspect | null;
}) {
    const navigate = useNavigate();
    const qc = useQueryClient();
    const [busy, setBusy] = useState<null | 'open' | 'publish' | 'render'>(null);

    const ready = build.status === 'AWAITING_EDIT' || build.status === 'RENDERED';
    const orientation = aspect === '9:16' ? 'portrait' : 'landscape';

    const openInEditor = async () => {
        if (!apiKey) return;
        setBusy('open');
        try {
            const full = await getStudioBuild(apiKey, build.id);
            const timelineUrl = (full.s3_urls as Record<string, string>)?.timeline;
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
                    wordsUrl: undefined,
                    avatarUrl: undefined,
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
            await renderStudioBuild(apiKey, build.id, {});
            qc.invalidateQueries({ queryKey: ['studio-project', instituteId, projectId] });
            toast.success('Render started — it’ll appear here when ready.');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Render failed.');
        } finally {
            setBusy(null);
        }
    };

    return (
        <li className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2">
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
                    <RowButton onClick={openInEditor} busy={busy === 'open'} icon={PencilSimple}>
                        Edit
                    </RowButton>
                )}
                {ready && (
                    <RowButton onClick={render} busy={busy === 'render'} icon={Sparkle}>
                        Render
                    </RowButton>
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
