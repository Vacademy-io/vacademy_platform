import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CaretLeft,
    CaretRight,
    FolderSimple,
    MagnifyingGlass,
    Play,
    PlayCircle,
    X,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useTrainingVideos, type TrainingVideoDto } from '@/services/training-videos';

interface TreeNode {
    name: string;
    path: string[];
    /** Every video at or below this node, so a branch click lists its whole subtree. */
    videos: TrainingVideoDto[];
    children: TreeNode[];
}

/** Groups videos by their module-path segments: LMS → Course creation → AI based course. */
function buildTree(videos: TrainingVideoDto[]): TreeNode[] {
    const roots: TreeNode[] = [];
    for (const video of videos) {
        const path = video.modulePath?.length ? video.modulePath : ['Uncategorized'];
        let level = roots;
        path.forEach((name, depth) => {
            let node = level.find((n) => n.name === name);
            if (!node) {
                node = { name, path: path.slice(0, depth + 1), videos: [], children: [] };
                level.push(node);
            }
            node.videos.push(video);
            level = node.children;
        });
    }
    const sort = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name));
        nodes.forEach((n) => sort(n.children));
    };
    sort(roots);
    return roots;
}

const samePath = (a: string[], b: string[]) =>
    a.length === b.length && a.every((segment, i) => segment === b[i]);

/**
 * Assist Dock "Training" popup - the LMS training library super admins publish from the
 * health-check dashboard. Videos sit in a module tree built from their module path and can
 * be searched by name, description or path; picking one plays it right here in the popup.
 */
export function TrainingViewer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation('trainingViewer');
    // Deferred like the roadmap body - only downloaded while the popup is open.
    const videos = useTrainingVideos(open);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [expanded, setExpanded] = useState<string[]>([]);
    const [playing, setPlaying] = useState<TrainingVideoDto | null>(null);

    useEffect(() => {
        if (!open) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (playing) {
                setPlaying(null);
                return;
            }
            onClose();
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose, open, playing]);

    const all = useMemo(() => videos.data ?? [], [videos.data]);
    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return all;
        return all.filter((v) =>
            [v.title, v.description ?? '', v.modulePath.join(' ')]
                .join(' ')
                .toLowerCase()
                .includes(term)
        );
    }, [all, search]);

    const tree = useMemo(() => buildTree(filtered), [filtered]);
    const listed = useMemo(
        () =>
            selected.length
                ? filtered.filter((v) =>
                      selected.every((segment, i) => v.modulePath[i] === segment)
                  )
                : filtered,
        [filtered, selected]
    );

    if (!open) return null;

    const toggleExpanded = (path: string[]) => {
        const key = path.join('|');
        setExpanded((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex justify-center bg-black/60 p-0 sm:p-4 lg:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="training-viewer-title"
            onClick={onClose}
        >
            <div
                className="flex size-full flex-col overflow-hidden bg-card text-card-foreground shadow-xl sm:rounded-lg"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header: title + search */}
                <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <PlayCircle size={20} className="shrink-0 text-primary-500" />
                        <h2
                            id="training-viewer-title"
                            className="truncate text-title font-semibold text-foreground"
                        >
                            {t('title')}
                        </h2>
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption text-neutral-500">
                            {all.length}
                        </span>
                    </div>
                    <div className="relative order-3 w-full sm:order-none sm:ml-auto sm:max-w-sm">
                        <MagnifyingGlass
                            size={16}
                            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('searchPlaceholder')}
                            className="h-10 w-full rounded-md border border-input bg-background pe-3 ps-10 text-body text-foreground outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                    </div>
                    <button
                        type="button"
                        aria-label={t('closeAriaLabel')}
                        onClick={onClose}
                        className="flex size-10 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body: module tree + video list, or the player once a video is picked */}
                <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                    {playing ? (
                        <PlayerPane
                            video={playing}
                            onBack={() => setPlaying(null)}
                            backLabel={t('back')}
                        />
                    ) : videos.isPending ? (
                        <div className="flex-1 overflow-hidden p-3">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {[0, 1, 2, 3, 4, 5].map((i) => (
                                    <div
                                        key={i}
                                        className="animate-pulse rounded-lg border border-neutral-200 bg-white p-2"
                                    >
                                        <div className="aspect-video rounded-md bg-neutral-200" />
                                        <div className="mt-2 h-3 w-3/4 rounded bg-neutral-200" />
                                        <div className="mt-1.5 h-3 w-1/2 rounded bg-neutral-100" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : videos.isError ? (
                        <p className="flex-1 self-center text-center text-caption text-neutral-500">
                            {t('error')}
                        </p>
                    ) : all.length === 0 ? (
                        <EmptyPane title={t('noVideos')} description={t('noVideosDescription')} />
                    ) : filtered.length === 0 ? (
                        <EmptyPane title={t('noResults')} description={t('noResultsDescription')} />
                    ) : (
                        <>
                            <aside className="max-h-48 w-full shrink-0 overflow-y-auto border-b border-border bg-muted/40 p-2 md:max-h-none md:w-72 md:border-b-0 md:border-e">
                                <button
                                    type="button"
                                    onClick={() => setSelected([])}
                                    className={cn(
                                        'flex min-h-10 w-full items-center gap-2 rounded-md px-3 py-2 text-start text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        selected.length === 0
                                            ? 'bg-primary-50 text-primary-600'
                                            : 'text-neutral-600 hover:bg-muted'
                                    )}
                                >
                                    <FolderSimple size={16} className="shrink-0" />
                                    <span className="min-w-0 flex-1 break-words">
                                        {t('allVideos')}
                                    </span>
                                    <span className="text-caption text-neutral-400">
                                        {filtered.length}
                                    </span>
                                </button>
                                <div className="mt-1 space-y-0.5">
                                    {tree.map((node) => (
                                        <TreeBranch
                                            key={node.name}
                                            node={node}
                                            depth={0}
                                            selected={selected}
                                            expanded={expanded}
                                            onSelect={setSelected}
                                            onToggle={toggleExpanded}
                                        />
                                    ))}
                                </div>
                            </aside>
                            <div className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
                                <div className="mb-3 flex min-w-0 items-center gap-2">
                                    <p
                                        className="min-w-0 flex-1 truncate text-body font-semibold text-foreground"
                                        title={
                                            selected.length ? selected.join(' › ') : t('allVideos')
                                        }
                                    >
                                        {selected.length ? selected.join(' › ') : t('allVideos')}
                                    </p>
                                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-caption text-muted-foreground">
                                        {listed.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {listed.map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => setPlaying(v)}
                                            aria-label={v.title}
                                            className="group flex h-full min-w-0 flex-col rounded-lg border border-border bg-card p-2 text-start transition-colors hover:border-primary-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-muted"
                                        >
                                            {/* First-frame thumbnail straight from the S3 video - no extra asset pipeline. */}
                                            <span className="relative block aspect-video overflow-hidden rounded-md bg-neutral-900">
                                                <video
                                                    src={`${v.fileUrl}#t=0.1`}
                                                    preload="metadata"
                                                    muted
                                                    playsInline
                                                    className="size-full object-cover"
                                                />
                                                <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/40">
                                                    <span className="flex size-10 items-center justify-center rounded-full bg-card/95 text-primary-600 shadow-sm transition-transform group-hover:scale-105">
                                                        <Play size={16} weight="fill" />
                                                    </span>
                                                </span>
                                            </span>
                                            <span
                                                className="mt-3 w-full break-words text-body font-semibold leading-snug text-foreground"
                                                title={v.title}
                                            >
                                                {v.title}
                                            </span>
                                            <span className="mt-2 flex min-w-0 items-start gap-1 text-caption text-muted-foreground">
                                                <FolderSimple
                                                    size={13}
                                                    className="mt-0.5 shrink-0"
                                                />
                                                <span
                                                    className="line-clamp-2 break-words"
                                                    title={v.modulePath.join(' › ')}
                                                >
                                                    {v.modulePath.join(' › ')}
                                                </span>
                                            </span>
                                            {v.description ? (
                                                <span className="mt-2 line-clamp-2 text-caption leading-relaxed text-neutral-500">
                                                    {v.description}
                                                </span>
                                            ) : null}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/** One branch of the module tree (e.g. "Course creation" under "LMS"). */
function TreeBranch({
    node,
    depth,
    selected,
    expanded,
    onSelect,
    onToggle,
}: {
    node: TreeNode;
    depth: number;
    selected: string[];
    expanded: string[];
    onSelect: (path: string[]) => void;
    onToggle: (path: string[]) => void;
}) {
    const key = node.path.join('|');
    const isOpen = expanded.includes(key);
    const isSelected = samePath(selected, node.path);
    return (
        <div>
            <div
                className={cn(
                    'flex w-full items-stretch rounded-md text-body transition-colors',
                    isSelected
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-neutral-600 hover:bg-muted'
                )}
                style={{
                    // Genuinely dynamic value: tree indentation scales with branch depth - no static token exists.
                    paddingInlineStart: depth * 12 + 4,
                }}
            >
                {node.children.length ? (
                    <button
                        type="button"
                        aria-label={node.name}
                        aria-expanded={isOpen}
                        onClick={() => onToggle(node.path)}
                        className="flex size-10 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8"
                    >
                        <CaretRight
                            size={14}
                            className={cn(
                                'shrink-0 text-neutral-400 transition-transform',
                                isOpen && 'rotate-90'
                            )}
                        />
                    </button>
                ) : (
                    <span className="w-10 shrink-0 md:w-8" />
                )}
                <button
                    type="button"
                    onClick={() => onSelect(node.path)}
                    title={node.name}
                    className="flex min-w-0 flex-1 items-start gap-2 rounded-md py-2 pe-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <FolderSimple size={15} className="mt-0.5 shrink-0 text-neutral-400" />
                    <span className="min-w-0 flex-1 break-words leading-snug">{node.name}</span>
                    <span className="shrink-0 text-caption text-neutral-400">
                        {node.videos.length}
                    </span>
                </button>
            </div>
            {isOpen && node.children.length ? (
                <div className="space-y-0.5">
                    {node.children.map((child) => (
                        <TreeBranch
                            key={child.name}
                            node={child}
                            depth={depth + 1}
                            selected={selected}
                            expanded={expanded}
                            onSelect={onSelect}
                            onToggle={onToggle}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

/** In-popup player shown after picking a video card. */
function PlayerPane({
    video,
    onBack,
    backLabel,
}: {
    video: TrainingVideoDto;
    onBack: () => void;
    backLabel: string;
}) {
    return (
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4">
            <button
                type="button"
                onClick={onBack}
                className="mb-3 flex w-fit items-center gap-1 text-caption text-neutral-500 transition-colors hover:text-primary-500"
            >
                <CaretLeft size={12} /> {backLabel}
            </button>
            <video
                key={video.id}
                src={video.fileUrl}
                controls
                playsInline
                className="max-h-96 w-full rounded-lg bg-black ring-1 ring-neutral-200"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="text-subtitle font-semibold text-neutral-800">{video.title}</p>
                <span className="flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-caption text-primary-600">
                    <FolderSimple size={11} />
                    {video.modulePath.join(' › ')}
                </span>
            </div>
            {video.description ? (
                <p className="mt-2 whitespace-pre-wrap text-caption leading-relaxed text-neutral-600">
                    {video.description}
                </p>
            ) : null}
        </div>
    );
}

function EmptyPane({ title, description }: { title: string; description: string }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
            <PlayCircle size={28} className="text-neutral-300" />
            <p className="text-caption font-semibold text-neutral-700">{title}</p>
            <p className="text-caption text-neutral-500">{description}</p>
        </div>
    );
}
