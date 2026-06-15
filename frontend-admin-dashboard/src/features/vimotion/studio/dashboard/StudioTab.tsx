/**
 * Studio dashboard tab — paginated list of Studio projects with filter chips
 * + per-project card. Mirrors the structure of ReelsTab. Empty state CTA
 * deep-links into the create wizard.
 *
 * P1: list + filter + new-project CTA + status-based UI. Builds are surfaced
 * by count; per-build navigation lands in P5 via the project detail page.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    Plus,
    StackSimple,
    Sparkle,
    Clock,
    CheckCircle,
    WarningCircle,
    Archive,
    FilmStrip,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { getInstituteId } from '@/constants/helper';
import { useVimotionApiKey } from '../../dashboard/hooks/useVimotionApiKey';
import { useStudioProjectsList } from '../hooks/useStudioProjects';
import type { ProjectStatus, ProjectSummary } from '../services/studio-api';

type StatusFilter = 'all' | 'BUILDING' | 'PUBLISHED' | 'DRAFT';

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'DRAFT', label: 'Draft' },
    { id: 'BUILDING', label: 'Building' },
    { id: 'PUBLISHED', label: 'Published' },
];

export function StudioTab() {
    const instituteId = getInstituteId();
    const apiKey = useVimotionApiKey(instituteId);
    const navigate = useNavigate();
    const [filter, setFilter] = useState<StatusFilter>('all');

    const projectsQuery = useStudioProjectsList({
        apiKey: apiKey.data,
        instituteId,
        params: { limit: 50 },
    });

    const filteredProjects = useMemo(() => {
        const data = projectsQuery.data ?? [];
        if (filter === 'all') return data;
        return data.filter((p) => p.status === filter);
    }, [projectsQuery.data, filter]);

    const startNewProject = () => {
        navigate({ to: '/vim/studio/new', search: { projectId: undefined } });
    };

    if (apiKey.isError) {
        return (
            <ErrorState message="Could not connect to the video service. Please try again." />
        );
    }

    return (
        <div className="space-y-5">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                    {STATUS_FILTERS.map((f) => (
                        <FilterChip
                            key={f.id}
                            current={filter}
                            value={f.id}
                            onClick={setFilter}
                        >
                            {f.label}
                        </FilterChip>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={startNewProject}
                    disabled={!apiKey.data}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-neutral-900 px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Plus weight="bold" className="size-4" />
                    New project
                </button>
            </div>

            {/* Body */}
            {apiKey.isLoading || projectsQuery.isLoading ? (
                <LoadingGrid />
            ) : projectsQuery.isError ? (
                <ErrorState
                    message={
                        projectsQuery.error instanceof Error
                            ? projectsQuery.error.message
                            : 'Could not load Studio projects.'
                    }
                />
            ) : filteredProjects.length === 0 ? (
                <EmptyState
                    hasAny={(projectsQuery.data ?? []).length > 0}
                    filter={filter}
                    onStart={startNewProject}
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredProjects.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function ProjectCard({ project }: { project: ProjectSummary }) {
    const navigate = useNavigate();
    const handleOpen = () => {
        navigate({
            to: '/vim/studio/$projectId',
            params: { projectId: project.id },
        });
    };
    return (
        <button
            type="button"
            onClick={handleOpen}
            className="group flex h-full flex-col rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-neutral-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <StackSimple weight="duotone" className="size-4 shrink-0 text-neutral-500" />
                    <h3 className="truncate text-sm font-semibold text-neutral-900">
                        {project.name || 'Untitled project'}
                    </h3>
                </div>
                <StatusBadge status={project.status} />
            </div>
            <div className="mt-auto flex items-center gap-3 text-xs text-neutral-500">
                <span className="inline-flex items-center gap-1">
                    <FilmStrip weight="duotone" className="size-3.5" />
                    {project.asset_count} {project.asset_count === 1 ? 'asset' : 'assets'}
                </span>
                <span className="inline-flex items-center gap-1">
                    <Sparkle weight="duotone" className="size-3.5" />
                    {project.build_count} {project.build_count === 1 ? 'build' : 'builds'}
                </span>
            </div>
        </button>
    );
}

// ---------------------------------------------------------------------------
// Status + filter helpers
// ---------------------------------------------------------------------------

interface StatusVisual {
    label: string;
    Icon: typeof Clock;
    className: string;
}

const STATUS_VISUAL: Record<ProjectStatus, StatusVisual> = {
    DRAFT: {
        label: 'Draft',
        Icon: Clock,
        className: 'bg-neutral-100 text-neutral-700',
    },
    PLANNING: {
        label: 'Planning',
        Icon: Sparkle,
        className: 'bg-amber-50 text-amber-700',
    },
    READY_TO_BUILD: {
        label: 'Ready to build',
        Icon: CheckCircle,
        className: 'bg-blue-50 text-blue-700',
    },
    BUILDING: {
        label: 'Building',
        Icon: Sparkle,
        className: 'bg-indigo-50 text-indigo-700',
    },
    PUBLISHED: {
        label: 'Published',
        Icon: CheckCircle,
        className: 'bg-emerald-50 text-emerald-700',
    },
    ARCHIVED: {
        label: 'Archived',
        Icon: Archive,
        className: 'bg-neutral-100 text-neutral-500',
    },
};

function StatusBadge({ status }: { status: ProjectStatus }) {
    const v = STATUS_VISUAL[status];
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium',
                v.className
            )}
        >
            <v.Icon weight="fill" className="size-3" />
            {v.label}
        </span>
    );
}

function FilterChip<T extends string>({
    current,
    value,
    children,
    onClick,
}: {
    current: T;
    value: T;
    children: React.ReactNode;
    onClick: (v: T) => void;
}) {
    const active = current === value;
    return (
        <button
            type="button"
            onClick={() => onClick(value)}
            className={cn(
                'inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors',
                active
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            )}
        >
            {children}
        </button>
    );
}

// ---------------------------------------------------------------------------
// State views
// ---------------------------------------------------------------------------

function LoadingGrid() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <div
                    key={i}
                    className="h-28 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50"
                />
            ))}
        </div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <WarningCircle weight="fill" className="size-5 shrink-0 text-rose-600" />
            <div className="text-sm text-rose-900">{message}</div>
        </div>
    );
}

function EmptyState({
    hasAny,
    filter,
    onStart,
}: {
    hasAny: boolean;
    filter: StatusFilter;
    onStart: () => void;
}) {
    if (hasAny && filter !== 'all') {
        return (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
                <p className="text-sm text-neutral-600">
                    No projects match this filter.
                </p>
            </div>
        );
    }
    return (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
            <StackSimple
                weight="duotone"
                className="mx-auto mb-3 size-10 text-neutral-400"
            />
            <h3 className="text-base font-semibold text-neutral-900">
                No Studio projects yet
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-600">
                Pick a few indexed videos and images, write a prompt, and Studio
                will arrange them into a polished video you can refine in the
                editor.
            </p>
            <button
                type="button"
                onClick={onStart}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800"
            >
                <Plus weight="bold" className="size-4" />
                Create your first Studio project
            </button>
        </div>
    );
}
