import { useQuery, useMutation } from '@tanstack/react-query';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { getCatalogueTags, deleteCatalogueConfig } from '../-services/catalogue-service';
import { Button } from '@/components/ui/button';
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
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { CreateCatalogueDialog } from './CreateCatalogueDialog';
import {
    Trash2,
    Pencil,
    ExternalLink,
    Globe,
    Plus,
    LayoutTemplate,
    Clock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCataloguePermissions } from '../-hooks/use-catalogue-permissions';

// Deterministic gradient from tag name
const GRADIENTS = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-rose-500',
    'from-pink-500 to-fuchsia-600',
    'from-amber-500 to-orange-600',
    'from-indigo-500 to-blue-600',
    'from-teal-500 to-green-600',
];

const getGradient = (name: string) =>
    GRADIENTS[name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % GRADIENTS.length];

const CardSkeleton = () => (
    <div className="animate-pulse overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="h-28 bg-gray-200" />
        <div className="p-4 space-y-3">
            <div className="h-4 w-2/3 rounded bg-gray-200" />
            <div className="h-3 w-1/3 rounded bg-gray-100" />
            <div className="h-3 w-1/2 rounded bg-gray-100" />
            <div className="mt-4 flex gap-2">
                <div className="h-8 flex-1 rounded bg-gray-200" />
                <div className="h-8 w-8 rounded bg-gray-100" />
            </div>
        </div>
    </div>
);

export const CatalogueList = () => {
    const instituteId = getCurrentInstituteId();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [deletingTag, setDeletingTag] = useState<string | null>(null);
    const [deleteConfirmTag, setDeleteConfirmTag] = useState<string | null>(null);
    const { canWrite, canDelete } = useCataloguePermissions();

    const {
        data: tags,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['catalogueTags', instituteId],
        queryFn: () => getCatalogueTags(instituteId!),
        enabled: !!instituteId,
    });

    const deleteMutation = useMutation({
        mutationFn: (tagName: string) => deleteCatalogueConfig(instituteId!, tagName),
        onSuccess: () => {
            toast({ title: 'Deleted', description: 'Site deleted successfully' });
            setDeletingTag(null);
            refetch();
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to delete site', variant: 'destructive' });
            setDeletingTag(null);
        },
    });

    const handleDelete = (tagName: string) => {
        setDeleteConfirmTag(tagName);
    };

    const confirmDelete = () => {
        if (!deleteConfirmTag) return;
        setDeletingTag(deleteConfirmTag);
        deleteMutation.mutate(deleteConfirmTag);
        setDeleteConfirmTag(null);
    };

    if (!instituteId) return <div className="p-6 text-gray-500">No institute selected</div>;

    const activeCount = tags?.filter((t) => t.status === 'ACTIVE').length ?? 0;
    const draftCount = tags?.filter((t) => t.status !== 'ACTIVE').length ?? 0;

    return (
        <div className="w-full bg-gray-50/60 p-6 md:p-8">
            {/* Header */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Manage Pages</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Build and publish your institute&apos;s learner portals
                    </p>
                </div>
                <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    disabled={!canWrite}
                    className="shrink-0 gap-1.5"
                >
                    <Plus className="size-4" />
                    New Site
                </Button>
            </div>

            {/* Stats row */}
            {!isLoading && tags && tags.length > 0 && (
                <div className="mb-6 flex gap-3">
                    <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm">
                        <LayoutTemplate className="size-4 text-gray-400" />
                        <span className="font-medium text-gray-700">{tags.length}</span>
                        <span className="text-gray-400">total</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm">
                        <span className="size-2 rounded-full bg-green-500" />
                        <span className="font-medium text-gray-700">{activeCount}</span>
                        <span className="text-gray-400">active</span>
                    </div>
                    {draftCount > 0 && (
                        <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm">
                            <span className="size-2 rounded-full bg-yellow-400" />
                            <span className="font-medium text-gray-700">{draftCount}</span>
                            <span className="text-gray-400">draft</span>
                        </div>
                    )}
                </div>
            )}

            {/* Card grid */}
            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
            ) : !tags || tags.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
                    <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-gray-100">
                        <Globe className="size-7 text-gray-400" />
                    </div>
                    <h3 className="mb-1 text-base font-semibold text-gray-700">No sites yet</h3>
                    <p className="mb-6 max-w-xs text-sm text-gray-400">
                        Create your first learner portal to start building pages and publishing content.
                    </p>
                    <Button onClick={() => setIsCreateDialogOpen(true)} disabled={!canWrite} className="gap-1.5">
                        <Plus className="size-4" />
                        Create your first site
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {tags.map((tag) => {
                        const isActive = tag.status === 'ACTIVE';
                        const gradient = getGradient(tag.tagName);
                        const initial = tag.tagName[0]?.toUpperCase() ?? '?';
                        const isDeleting = deletingTag === tag.tagName;

                        return (
                            <div
                                key={tag.tagName}
                                className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md"
                            >
                                {/* Card hero */}
                                <div
                                    className={`relative flex h-28 items-center justify-center bg-gradient-to-br ${gradient}`}
                                >
                                    <span className="text-4xl font-bold text-white/30 select-none">
                                        {initial}
                                    </span>
                                    {/* Status badge */}
                                    <span
                                        className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                            isActive
                                                ? 'bg-green-500/90 text-white'
                                                : 'bg-white/20 text-white/90'
                                        }`}
                                    >
                                        {isActive ? 'Active' : tag.status === 'DRAFT' ? 'Draft' : tag.status}
                                    </span>
                                </div>

                                {/* Card body */}
                                <div className="p-4">
                                    <h3 className="truncate text-sm font-semibold text-gray-900">
                                        {tag.tagName}
                                    </h3>

                                    {tag.lastModified ? (
                                        <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                                            <Clock className="size-3" />
                                            {new Date(tag.lastModified).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </div>
                                    ) : (
                                        <div className="mt-1 text-[11px] text-gray-300">Never modified</div>
                                    )}

                                    {/* Page count */}
                                    {(() => {
                                        try {
                                            const cfg = tag.catalogueJson ? JSON.parse(tag.catalogueJson) : null;
                                            const count = cfg?.pages?.length;
                                            if (!count) return null;
                                            return (
                                                <div className="mt-1 text-[11px] text-gray-400">
                                                    {count} page{count !== 1 ? 's' : ''}
                                                </div>
                                            );
                                        } catch {
                                            return null;
                                        }
                                    })()}

                                    {/* Actions */}
                                    <div className="mt-4 flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            className="flex-1 gap-1.5 text-xs"
                                            onClick={() =>
                                                navigate({
                                                    to: '/manage-pages/editor/$tagName',
                                                    params: { tagName: tag.tagName },
                                                })
                                            }
                                        >
                                            <Pencil className="size-3" />
                                            Edit
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="size-8 p-0 text-gray-400 hover:text-gray-700"
                                            asChild
                                            title="View live site"
                                        >
                                            <a
                                                href={`/${tag.tagName}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <ExternalLink className="size-3.5" />
                                            </a>
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="size-8 p-0 text-gray-400 hover:text-red-600 hover:border-red-200"
                                            disabled={!canDelete || isDeleting}
                                            onClick={() => handleDelete(tag.tagName)}
                                            title="Delete site"
                                        >
                                            {isDeleting ? (
                                                <span className="size-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                                            ) : (
                                                <Trash2 className="size-3.5" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* "Add new" card */}
                    {canWrite && (
                        <button
                            onClick={() => setIsCreateDialogOpen(true)}
                            className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-white text-gray-400 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-600"
                        >
                            <div className="flex size-10 items-center justify-center rounded-full bg-gray-100">
                                <Plus className="size-5" />
                            </div>
                            <span className="text-sm font-medium">New site</span>
                        </button>
                    )}
                </div>
            )}

            <CreateCatalogueDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onSuccess={() => refetch()}
            />

            <AlertDialog
                open={!!deleteConfirmTag}
                onOpenChange={(open) => !open && setDeleteConfirmTag(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete &quot;{deleteConfirmTag}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the site and all its pages. This action
                            cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
