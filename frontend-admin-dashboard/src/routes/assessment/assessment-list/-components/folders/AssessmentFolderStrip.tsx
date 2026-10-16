import { useTranslation } from 'react-i18next';
import { useDndContext, useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    DotsSixVertical,
    DotsThreeVertical,
    EyeSlash,
    FolderMinus,
    HandGrabbing,
    Link as LinkIcon,
    PencilSimple,
    Plus,
    Stack,
    Trash,
} from '@phosphor-icons/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { FolderThumb } from '@/components/common/assessment-folders/FolderThumb';
import { UNFILED_FOLDER_ID, type AssessmentFolder } from '@/services/assessment-folders';
import {
    DRAG_TYPE_ASSESSMENT,
    DRAG_TYPE_FOLDER,
    DROP_ALL_ID,
    DROP_UNFILED_ID,
} from './assessment-folder-context';

export interface FolderStripActions {
    onSelect: (key: string) => void;
    onCreate: () => void;
    onEdit: (folder: AssessmentFolder) => void;
    onDelete: (folder: AssessmentFolder) => void;
    onCopyLink: (folder: AssessmentFolder) => void;
}

const useIsDraggingAssessment = () => {
    const { active } = useDndContext();
    return active?.data.current?.type === DRAG_TYPE_ASSESSMENT;
};

/**
 * One slim row of folder chips between the filters and the cards: All, each folder,
 * "Not in a folder", then "+ New folder". Chips are drop targets for assessment
 * cards; a folder's ⋮ (edit, copy link, delete) and reorder grip show on hover.
 */
export const AssessmentFolderStrip = ({
    folders,
    selectedKey,
    selectedFolder,
    loading,
    ...actions
}: FolderStripActions & {
    folders: AssessmentFolder[];
    selectedKey: string;
    selectedFolder?: AssessmentFolder;
    loading: boolean;
}) => {
    const { t } = useTranslation('assessmentFolders');
    const draggingAssessment = useIsDraggingAssessment();
    return (
        <section aria-label={t('rail.title')} className="relative mb-3">
            {/* Drop hint floats above the row: any text inside the row would re-wrap the
                chips as the drag starts and move the folder under the pointer. */}
            {draggingAssessment ? (
                <p className="absolute bottom-full left-0 mb-0.5 flex items-center gap-1 text-caption font-medium text-primary-500">
                    <HandGrabbing size={14} />
                    {t('rail.dropHint')}
                </p>
            ) : null}
            <div
                className={cn(
                    '-mx-2 flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                    draggingAssessment && 'bg-primary-50 ring-1 ring-primary-200'
                )}
            >
                <span className="shrink-0 text-sm text-neutral-500" title={t('rail.tip')}>
                    {t('rail.title')}:
                </span>
                <StaticChip
                    dropId={DROP_ALL_ID}
                    acceptsDrop={false}
                    active={selectedKey === 'all'}
                    onClick={() => actions.onSelect('all')}
                    icon={<Stack size={14} />}
                    label={t('rail.all')}
                />
                <SortableContext items={folders.map((f) => f.id)} strategy={rectSortingStrategy}>
                    {folders.map((folder) => (
                        <FolderChip
                            key={folder.id}
                            folder={folder}
                            active={selectedKey === folder.id}
                            {...actions}
                        />
                    ))}
                </SortableContext>
                <StaticChip
                    dropId={DROP_UNFILED_ID}
                    acceptsDrop
                    active={selectedKey === UNFILED_FOLDER_ID}
                    onClick={() => actions.onSelect(UNFILED_FOLDER_ID)}
                    icon={<FolderMinus size={14} />}
                    label={t('rail.unfiled')}
                />
                <button
                    type="button"
                    onClick={actions.onCreate}
                    className="flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-3 py-1 text-sm text-neutral-600 hover:border-primary-400 hover:text-primary-500"
                >
                    <Plus size={14} />
                    {t('rail.newFolder')}
                </button>
                {loading ? (
                    <span className="text-caption text-neutral-400">{t('rail.loading')}</span>
                ) : null}
            </div>
            {selectedFolder && selectedFolder.assessment_count === 0 ? (
                <p className="mt-1 text-caption text-neutral-500">{t('banner.emptyHint')}</p>
            ) : null}
        </section>
    );
};

const chipClasses = (active: boolean, dropReady: boolean) =>
    cn(
        'group flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-left text-sm transition-colors',
        active
            ? 'border-primary-500 bg-primary-50 text-primary-500'
            : 'border-neutral-200 text-neutral-700 hover:border-primary-300',
        dropReady && 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
    );

const StaticChip = ({
    dropId,
    acceptsDrop,
    active,
    onClick,
    icon,
    label,
}: {
    dropId: string;
    acceptsDrop: boolean;
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) => {
    const { setNodeRef, isOver } = useDroppable({ id: dropId, disabled: !acceptsDrop });
    const draggingAssessment = useIsDraggingAssessment();
    return (
        <button
            ref={setNodeRef}
            type="button"
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className={chipClasses(active, acceptsDrop && draggingAssessment && isOver)}
        >
            <span className="shrink-0 text-neutral-500">{icon}</span>
            <span className="font-medium">{label}</span>
        </button>
    );
};

const FolderChip = ({
    folder,
    active,
    onSelect,
    onEdit,
    onDelete,
    onCopyLink,
}: FolderStripActions & { folder: AssessmentFolder; active: boolean }) => {
    const { t } = useTranslation('assessmentFolders');
    const draggingAssessment = useIsDraggingAssessment();
    const {
        setNodeRef,
        setActivatorNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
        isOver,
    } = useSortable({ id: folder.id, data: { type: DRAG_TYPE_FOLDER, folderId: folder.id } });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }} // design-lint-ignore: dnd-kit drag transform is per-frame dynamic
            className={cn(
                chipClasses(active, draggingAssessment && isOver),
                'relative',
                isDragging && 'z-10 opacity-70 shadow-md'
            )}
        >
            <button
                ref={setActivatorNodeRef}
                type="button"
                aria-label={t('rail.reorder', { name: folder.name })}
                title={t('rail.reorder', { name: folder.name })}
                className="-ml-1 cursor-grab touch-none text-neutral-400 opacity-0 transition-opacity hover:text-neutral-600 focus-visible:opacity-100 active:cursor-grabbing group-hover:opacity-100"
                {...attributes}
                {...listeners}
            >
                <DotsSixVertical size={14} />
            </button>
            <button
                type="button"
                onClick={() => onSelect(folder.id)}
                aria-current={active ? 'page' : undefined}
                className="flex min-w-0 items-center gap-2 text-left"
            >
                <FolderThumb imageUrl={folder.image_url} className="size-5 rounded" iconSize={12} />
                <span className="max-w-40 truncate font-medium">{folder.name}</span>
                {folder.status === 'HIDDEN' ? (
                    <EyeSlash
                        size={14}
                        className="shrink-0 text-neutral-400"
                        aria-label={t('rail.hidden')}
                    />
                ) : null}
                <span
                    className={cn(
                        'rounded-full px-1.5 text-caption',
                        active
                            ? 'bg-primary-100 text-primary-500'
                            : 'bg-neutral-100 text-neutral-600'
                    )}
                >
                    {folder.assessment_count}
                </span>
            </button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label={t('menu.folderActions', { name: folder.name })}
                        className={cn(
                            // Fades instead of hiding, so a chip never changes width under a drag.
                            '-mr-1 rounded-full p-0.5 text-neutral-500 transition-opacity hover:bg-neutral-100 hover:text-neutral-800 focus-visible:opacity-100 data-[state=open]:opacity-100',
                            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        )}
                    >
                        <DotsThreeVertical size={16} />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onSelect={() => onEdit(folder)}
                    >
                        <PencilSimple size={16} />
                        {t('menu.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onSelect={() => onCopyLink(folder)}
                    >
                        <LinkIcon size={16} />
                        {t('menu.copyLink')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="cursor-pointer gap-2 text-danger-600 focus:text-danger-600"
                        onSelect={() => onDelete(folder)}
                    >
                        <Trash size={16} />
                        {t('menu.delete')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
