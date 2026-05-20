import { useQuery, useMutation } from '@tanstack/react-query';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { getAllProductPages, deleteProductPage } from '../-services/product-pages-service';
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
import { CreateProductPageDialog } from './CreateProductPageDialog';
import { Trash2, Pencil, Plus, ShoppingCart, Hash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MyButton } from '@/components/design-system/button';
import { StatusChip } from '@/components/design-system/status-chips';
import type { ProductPageResponse } from '../-types/product-page-types';

const GRADIENTS = [
    'from-primary-400 to-primary-600',
    'from-blue-400 to-blue-600',
    'from-emerald-400 to-teal-600',
    'from-orange-400 to-rose-500',
    'from-pink-400 to-fuchsia-600',
    'from-amber-400 to-orange-500',
    'from-indigo-400 to-blue-600',
    'from-teal-400 to-green-600',
];

const getGradient = (name: string) =>
    GRADIENTS[name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % GRADIENTS.length];

const CardSkeleton = () => (
    <div className="animate-pulse overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="h-24 bg-neutral-100" />
        <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 rounded bg-neutral-100" />
            <div className="h-3 w-1/3 rounded bg-neutral-100" />
            <div className="mt-4 flex gap-2">
                <div className="h-8 flex-1 rounded bg-neutral-100" />
                <div className="h-8 w-8 rounded bg-neutral-100" />
            </div>
        </div>
    </div>
);

export const ProductPagesList = () => {
    const instituteId = getCurrentInstituteId();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteConfirmPage, setDeleteConfirmPage] = useState<ProductPageResponse | null>(null);

    const {
        data: pages,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['productPages', instituteId],
        queryFn: () => getAllProductPages(instituteId!),
        enabled: !!instituteId,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteProductPage(id),
        onSuccess: () => {
            toast({ title: 'Deleted', description: 'Product page deleted successfully' });
            setDeletingId(null);
            refetch();
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to delete product page', variant: 'destructive' });
            setDeletingId(null);
        },
    });

    const confirmDelete = () => {
        if (!deleteConfirmPage) return;
        setDeletingId(deleteConfirmPage.id);
        deleteMutation.mutate(deleteConfirmPage.id);
        setDeleteConfirmPage(null);
    };

    if (!instituteId) return <div className="p-6 text-neutral-500">No institute selected</div>;

    const activeCount = pages?.filter((p) => p.status === 'ACTIVE').length ?? 0;
    const draftCount = pages?.filter((p) => p.status === 'DRAFT').length ?? 0;

    return (
        <div className="animate-fadeIn flex flex-col gap-6 p-6 lg:p-8">
            {/* Page header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-neutral-800">Product Pages</h1>
                    <p className="mt-0.5 text-sm text-neutral-500">
                        Multi-course enrollment landing pages with a combined checkout
                    </p>
                </div>
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={() => setIsCreateDialogOpen(true)}
                >
                    <Plus className="size-4" />
                    New Product Page
                </MyButton>
            </div>

            {/* Stats row */}
            {!isLoading && pages && pages.length > 0 && (
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm">
                        <ShoppingCart className="size-4 text-neutral-400" />
                        <span className="font-semibold text-neutral-700">{pages.length}</span>
                        <span className="text-neutral-400">total</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm">
                        <span className="size-2 rounded-full bg-success-500" />
                        <span className="font-semibold text-neutral-700">{activeCount}</span>
                        <span className="text-neutral-400">active</span>
                    </div>
                    {draftCount > 0 && (
                        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm">
                            <span className="size-2 rounded-full bg-warning-400" />
                            <span className="font-semibold text-neutral-700">{draftCount}</span>
                            <span className="text-neutral-400">draft</span>
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
            ) : !pages || pages.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-white py-20 text-center">
                    <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-50">
                        <ShoppingCart className="size-7 text-primary-400" />
                    </div>
                    <h3 className="mb-1 text-base font-semibold text-neutral-700">No product pages yet</h3>
                    <p className="mb-6 max-w-xs text-sm text-neutral-400">
                        Create a product page to let learners add multiple courses to a cart and pay in one go.
                    </p>
                    <MyButton buttonType="primary" scale="medium" onClick={() => setIsCreateDialogOpen(true)}>
                        <Plus className="size-4" />
                        Create your first product page
                    </MyButton>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {pages.map((page) => {
                        const isActive = page.status === 'ACTIVE';
                        const gradient = getGradient(page.name);
                        const initial = page.name[0]?.toUpperCase() ?? '?';
                        const isDeleting = deletingId === page.id;

                        return (
                            <div
                                key={page.id}
                                className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                            >
                                <div
                                    className={`relative flex h-24 items-center justify-center bg-gradient-to-br ${gradient}`}
                                >
                                    <span className="select-none text-5xl font-bold text-white/20">
                                        {initial}
                                    </span>
                                    <div className="absolute right-3 top-3">
                                        <StatusChip
                                            text={isActive ? 'Active' : 'Draft'}
                                            textSize="text-[10px]"
                                            status={isActive ? 'SUCCESS' : 'WARNING'}
                                            showIcon={false}
                                        />
                                    </div>
                                </div>

                                <div className="p-4">
                                    <h3 className="truncate text-sm font-semibold text-neutral-800">
                                        {page.name}
                                    </h3>

                                    <div className="mt-1 flex items-center gap-1 text-[11px] text-neutral-400">
                                        <Hash className="size-3" />
                                        <span className="font-mono">{page.code}</span>
                                    </div>

                                    {page.mappings?.length > 0 && (
                                        <div className="mt-0.5 text-[11px] text-neutral-400">
                                            {page.mappings.length} course{page.mappings.length !== 1 ? 's' : ''}
                                        </div>
                                    )}

                                    <div className="mt-4 flex items-center gap-2">
                                        <MyButton
                                            scale="small"
                                            buttonType="primary"
                                            className="flex-1"
                                            onClick={() =>
                                                navigate({
                                                    to: '/manage-pages/product-pages/editor/$productPageId',
                                                    params: { productPageId: page.id },
                                                })
                                            }
                                        >
                                            <Pencil className="size-3" />
                                            Edit
                                        </MyButton>

                                        <MyButton
                                            scale="small"
                                            buttonType="secondary"
                                            layoutVariant="icon"
                                            disable={isDeleting}
                                            onClick={() => setDeleteConfirmPage(page)}
                                            title="Delete page"
                                        >
                                            {isDeleting ? (
                                                <span className="size-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
                                            ) : (
                                                <Trash2 className="size-3.5 text-danger-500" />
                                            )}
                                        </MyButton>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Add new card */}
                    <button
                        onClick={() => setIsCreateDialogOpen(true)}
                        className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 bg-white text-neutral-400 transition-all hover:border-primary-300 hover:bg-primary-50/30 hover:text-primary-500"
                    >
                        <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100 transition-colors group-hover:bg-primary-100">
                            <Plus className="size-5" />
                        </div>
                        <span className="text-sm font-medium">New product page</span>
                    </button>
                </div>
            )}

            <CreateProductPageDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onCreated={(id) => {
                    navigate({
                        to: '/manage-pages/product-pages/editor/$productPageId',
                        params: { productPageId: id },
                    });
                }}
            />

            <AlertDialog
                open={!!deleteConfirmPage}
                onOpenChange={(open) => !open && setDeleteConfirmPage(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete &quot;{deleteConfirmPage?.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this product page. Learners with the link will no
                            longer be able to access it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-danger-600 hover:bg-danger-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
