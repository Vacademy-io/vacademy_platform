import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MoreHorizontal, Plus, Pencil, Trash2, UserSquare2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { getInstituteId } from '@/constants/helper';
import { listAvatars, deleteAvatar } from '../api/avatars';
import type { StudioAvatar } from '../api/dashboardTypes';
import { colorForInitials, findCatalogEntry, getInitials } from '../avatars/catalog';
import { AvatarDrawer } from './AvatarDrawer';

export function AvatarsTab() {
    const instituteId = getInstituteId() ?? '';
    const queryClient = useQueryClient();

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingAvatar, setEditingAvatar] = useState<StudioAvatar | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const avatarsQuery = useQuery({
        queryKey: ['vimotion-avatars', instituteId],
        queryFn: () => listAvatars(instituteId),
        enabled: !!instituteId,
    });

    const remove = useMutation({
        mutationFn: (id: string) => deleteAvatar(id, instituteId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vimotion-avatars', instituteId] });
            toast.success('Avatar deleted');
            setDeletingId(null);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to delete avatar';
            toast.error(msg);
        },
    });

    const openCreate = () => {
        setEditingAvatar(null);
        setDrawerOpen(true);
    };
    const openEdit = (avatar: StudioAvatar) => {
        setEditingAvatar(avatar);
        setDrawerOpen(true);
    };

    const avatars = avatarsQuery.data ?? [];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-neutral-900">Avatars</h2>
                    <p className="text-sm text-neutral-500">
                        Saved hosts you can drop into any video.
                    </p>
                </div>
                <Button
                    onClick={openCreate}
                    className="gap-2 bg-neutral-900 text-white hover:bg-neutral-800"
                >
                    <Plus className="size-4" />
                    New avatar
                </Button>
            </div>

            {avatarsQuery.isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="h-44 animate-pulse rounded-xl border border-neutral-200 bg-white"
                        />
                    ))}
                </div>
            ) : avatars.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-neutral-50 ring-1 ring-neutral-200">
                        <UserSquare2 className="size-5 text-primary-500" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-neutral-900">No avatars yet</h3>
                    <p
                        className="mt-2 max-w-sm text-sm text-neutral-500"
                        style={{ marginInline: 'auto' }}
                    >
                        Add a face image and voice once — reuse it across all your videos.
                    </p>
                    <Button
                        onClick={openCreate}
                        className="mt-5 gap-2 bg-neutral-900 text-white hover:bg-neutral-800"
                    >
                        <Plus className="size-4" />
                        Add your first avatar
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {avatars.map((a) => (
                        <AvatarCard
                            key={a.id}
                            avatar={a}
                            onEdit={() => openEdit(a)}
                            onDelete={() => setDeletingId(a.id)}
                        />
                    ))}
                </div>
            )}

            {instituteId && (
                <AvatarDrawer
                    open={drawerOpen}
                    onOpenChange={setDrawerOpen}
                    instituteId={instituteId}
                    avatar={editingAvatar}
                />
            )}

            <AlertDialog
                open={deletingId != null}
                onOpenChange={(open) => !open && setDeletingId(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this avatar?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This can&rsquo;t be undone. Videos already created using this avatar
                            keep their copies.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={remove.isPending}
                            onClick={() => deletingId && remove.mutate(deletingId)}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            {remove.isPending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

interface AvatarCardProps {
    avatar: StudioAvatar;
    onEdit: () => void;
    onDelete: () => void;
}

function AvatarCard({ avatar, onEdit, onDelete }: AvatarCardProps) {
    const isBuiltIn = avatar.provider !== 'custom';
    const catalogEntry = isBuiltIn
        ? findCatalogEntry(avatar.provider, avatar.external_avatar_id)
        : undefined;
    const previewSrc = avatar.preview_image_url || avatar.face_image_url;
    const initialsSeed = avatar.external_avatar_id ?? avatar.name;

    return (
        <div className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-colors hover:border-neutral-300">
            <button
                type="button"
                onClick={onEdit}
                className="aspect-[4/3] w-full overflow-hidden bg-neutral-100"
                aria-label={`Edit ${avatar.name}`}
            >
                {previewSrc ? (
                    <img
                        src={previewSrc}
                        alt={avatar.name}
                        className="size-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                ) : isBuiltIn ? (
                    <div
                        className="flex size-full items-center justify-center text-2xl font-semibold text-neutral-700"
                        style={{ backgroundColor: colorForInitials(initialsSeed) }}
                    >
                        {getInitials(catalogEntry?.name ?? avatar.name)}
                    </div>
                ) : (
                    <div className="flex size-full items-center justify-center text-neutral-400">
                        <UserSquare2 className="size-10" />
                    </div>
                )}
            </button>
            <div className="flex items-start gap-2 p-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-neutral-900">{avatar.name}</p>
                        {isBuiltIn && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                                {avatar.provider}
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {avatar.voice_id
                            ? `${avatar.voice_language ?? ''}${avatar.voice_gender ? ` · ${avatar.voice_gender}` : ''}`
                            : isBuiltIn && catalogEntry?.category
                              ? catalogEntry.category
                              : 'No voice set'}
                    </p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                        >
                            <MoreHorizontal className="size-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={onEdit}>
                            <Pencil className="mr-2 size-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={onDelete}
                            className="text-red-600 focus:bg-red-50 focus:text-red-700"
                        >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
