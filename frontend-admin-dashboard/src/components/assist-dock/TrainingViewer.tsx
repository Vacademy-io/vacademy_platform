import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CaretDown,
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
 * Assist Dock "Training" popup — the LMS training library super admins publish from the
 * health-check dashboard. Videos sit in a module tree built from their module path and can
 * be searched by name, description or path; picking one plays it right here in the popup.
 */
export function TrainingViewer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation('trainingViewer');
    // Deferred like the roadmap body — only downloaded while the popup is open.
    const videos = useTrainingVideos(open);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [expanded, setExpanded] = useState<string[]>([]);
    const [playing, setPlaying] = useState<TrainingVideoDto | null>(null);

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
            className="fixed inset-0 z-50 flex justify-center bg-black/60 p-4 sm:p-10"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="flex size-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header — title + search */}
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <PlayCircle size={18} className="text-primary-500" />
                        <p className="text-subtitle font-semibold text-neutral-800">{t('title')}</p>
                    </div>
                    <div className="relative ml-auto w-full max-w-xs">
                        <MagnifyingGlass
                            size={14}
                            className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('searchPlaceholder')}
                            className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pe-2 ps-8 text-caption text-neutral-700 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-300 focus:bg-white"
                        />
                    </div>
                    <button
                        type="button"
                        aria-label={t('closeAriaLabel')}
                        onClick={onClose}
                        className="flex size-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body — module tree + video list, or the player once a video is picked */}
                <div className="flex min-h-0 flex-1">
                    {playing ? (
                        <PlayerPane
                            video={playing}
                            onBack={() => setPlaying(null)}
                            backLabel={t('back')}
                        />
                    ) : videos.isPending ? (
                        <div className="flex flex-1 items-center justify-center">
                            <div className="size-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
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
                            <aside className="w-56 shrink-0 overflow-y-auto border-r border-neutral-200 p-2">
                                <button
                                    type="button"
                                    onClick={() => setSelected([])}
                                    className={cn(
                                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-caption font-medium transition-colors',
                                        selected.length === 0
                                            ? 'bg-primary-50 text-primary-600'
                                            : 'text-neutral-600 hover:bg-neutral-100'
                                    )}
                                >
                                    <FolderSimple size={14} />
                                    <span className="flex-1 truncate">{t('allVideos')}</span>
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
                            <div className="flex-1 overflow-y-auto p-3">
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {listed.map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => setPlaying(v)}
                                            className="group flex flex-col gap-1 rounded-md border border-neutral-200 p-3 text-start transition-colors hover:border-primary-300 hover:bg-primary-50"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-500 group-hover:bg-primary-100">
                                                    <Play size={12} weight="fill" />
                                                </span>
                                                <span className="truncate text-caption font-semibold text-neutral-800">
                                                    {v.title}
                                                </span>
                                            </span>
                                            <span className="truncate ps-9 text-caption text-primary-500">
                                                {v.modulePath.join(' › ')}
                                            </span>
                                            {v.description ? (
                                                <span className="line-clamp-2 ps-9 text-caption leading-snug text-neutral-500">
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
                    'flex w-full items-center gap-1 rounded-md pe-2 text-caption transition-colors',
                    isSelected
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-neutral-600 hover:bg-neutral-100'
                )}
                style={{
                    // Genuinely dynamic value: tree indentation scales with branch depth — no static token exists.
                    paddingLeft: depth * 12 + 4,
                }}
            >
                <button
                    type="button"
                    onClick={() =>
                        node.children.length ? onToggle(node.path) : onSelect(node.path)
                    }
                    className="flex min-w-0 flex-1 items-center gap-1 py-1.5 text-start"
                >
                    {node.children.length ? (
                        isOpen ? (
                            <CaretDown size={12} className="shrink-0 text-neutral-400" />
                        ) : (
                            <CaretRight size={12} className="shrink-0 text-neutral-400" />
                        )
                    ) : (
                        <span className="w-3 shrink-0" />
                    )}
                    <FolderSimple size={13} className="shrink-0 text-neutral-400" />
                    <span className="flex-1 truncate">{node.name}</span>
                </button>
                <button
                    type="button"
                    onClick={() => onSelect(node.path)}
                    className="shrink-0 text-caption text-neutral-400 transition-colors hover:text-primary-500"
                >
                    {node.videos.length}
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
                className="max-h-96 w-full rounded-md bg-black"
            />
            <p className="mt-3 text-subtitle font-semibold text-neutral-800">{video.title}</p>
            <p className="mt-0.5 text-caption text-primary-500">{video.modulePath.join(' › ')}</p>
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
