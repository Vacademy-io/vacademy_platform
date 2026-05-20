import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, MoreHorizontal, Palette, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
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
import { deleteBrandKit, listBrandKits, setDefaultBrandKit } from '../api/brandKits';
import type { BrandKit } from '../api/dashboardTypes';
import { BrandKitDrawer } from './BrandKitDrawer';

export function BrandKitsTab() {
    const instituteId = getInstituteId() ?? '';
    const queryClient = useQueryClient();

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingKit, setEditingKit] = useState<BrandKit | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const kitsQuery = useQuery({
        queryKey: ['vimotion-brand-kits', instituteId],
        queryFn: () => listBrandKits(instituteId),
        enabled: !!instituteId,
    });

    const setDefault = useMutation({
        mutationFn: (id: string) => setDefaultBrandKit(id, instituteId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vimotion-brand-kits', instituteId] });
            toast.success('Default kit updated');
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to update default';
            toast.error(msg);
        },
    });

    const remove = useMutation({
        mutationFn: (id: string) => deleteBrandKit(id, instituteId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vimotion-brand-kits', instituteId] });
            toast.success('Brand kit deleted');
            setDeletingId(null);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to delete';
            toast.error(msg);
        },
    });

    const openCreate = () => {
        setEditingKit(null);
        setDrawerOpen(true);
    };
    const openEdit = (kit: BrandKit) => {
        setEditingKit(kit);
        setDrawerOpen(true);
    };

    const kits = kitsQuery.data ?? [];

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-neutral-900">Brand Kits</h2>
                    <p className="text-sm text-neutral-500">
                        Palette, fonts, layout, and intro/outro/watermark — bundled and swappable.
                    </p>
                </div>
                <Button
                    onClick={openCreate}
                    className="shrink-0 gap-2 bg-neutral-900 text-white hover:bg-neutral-800"
                >
                    <Plus className="size-4" />
                    New kit
                </Button>
            </div>

            {kitsQuery.isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="h-44 animate-pulse rounded-xl border border-neutral-200 bg-white"
                        />
                    ))}
                </div>
            ) : kits.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-neutral-50 ring-1 ring-neutral-200">
                        <Palette className="size-5 text-primary-500" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-neutral-900">
                        No brand kits yet
                    </h3>
                    <p
                        className="mt-2 max-w-sm text-sm text-neutral-500"
                        style={{ marginInline: 'auto' }}
                    >
                        Create your first kit so every video you generate stays on-brand by default.
                    </p>
                    <Button
                        onClick={openCreate}
                        className="mt-5 gap-2 bg-neutral-900 text-white hover:bg-neutral-800"
                    >
                        <Plus className="size-4" />
                        Create your first kit
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {kits.map((k) => (
                        <BrandKitCard
                            key={k.id}
                            kit={k}
                            onEdit={() => openEdit(k)}
                            onSetDefault={() => setDefault.mutate(k.id)}
                            onDelete={() => setDeletingId(k.id)}
                            settingDefault={setDefault.isPending}
                        />
                    ))}
                </div>
            )}

            {instituteId && (
                <BrandKitDrawer
                    open={drawerOpen}
                    onOpenChange={setDrawerOpen}
                    instituteId={instituteId}
                    kit={editingKit}
                />
            )}

            <AlertDialog
                open={deletingId != null}
                onOpenChange={(open) => !open && setDeletingId(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this brand kit?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Videos already generated with this kit are unaffected. If this was the
                            default, the studio falls back to the legacy single-config style until
                            another default is set.
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

interface BrandKitCardProps {
    kit: BrandKit;
    onEdit: () => void;
    onSetDefault: () => void;
    onDelete: () => void;
    settingDefault: boolean;
}

function BrandKitCard({ kit, onEdit, onSetDefault, onDelete, settingDefault }: BrandKitCardProps) {
    const swatches = [
        kit.palette.primary,
        kit.palette.secondary,
        kit.palette.accent,
        kit.palette.background,
    ].filter((c): c is string => !!c);

    return (
        <div className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-colors hover:border-neutral-300">
            <button
                type="button"
                onClick={onEdit}
                className="aspect-[5/3] w-full bg-neutral-50 p-4"
                aria-label={`Edit ${kit.name}`}
            >
                <div className="flex h-full flex-col justify-between">
                    <div className="flex flex-wrap gap-1.5">
                        {swatches.length === 0 ? (
                            <div className="flex h-8 items-center text-xs text-neutral-400">
                                No palette set
                            </div>
                        ) : (
                            swatches.map((c, i) => (
                                <span
                                    key={i}
                                    className="size-8 rounded-md ring-1 ring-black/5"
                                    style={{ backgroundColor: c }}
                                    title={c}
                                />
                            ))
                        )}
                    </div>
                    <div className="text-left text-xs text-neutral-500">
                        {kit.heading_font || 'Inter'} · {kit.body_font || 'Inter'}
                    </div>
                </div>
            </button>
            <div className="flex items-start gap-2 p-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-neutral-900">{kit.name}</p>
                        {kit.is_default && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                                <Check className="size-3" />
                                Default
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {kit.background_type === 'black' ? 'Dark' : 'Light'}
                        {kit.layout_theme ? ` · ${kit.layout_theme}` : ''}
                    </p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label="Brand kit actions"
                            className="inline-flex size-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                        >
                            <MoreHorizontal className="size-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={onEdit}>
                            <Pencil className="mr-2 size-4" />
                            Edit
                        </DropdownMenuItem>
                        {!kit.is_default && (
                            <DropdownMenuItem onSelect={onSetDefault} disabled={settingDefault}>
                                <Star className="mr-2 size-4" />
                                Set as default
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
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
