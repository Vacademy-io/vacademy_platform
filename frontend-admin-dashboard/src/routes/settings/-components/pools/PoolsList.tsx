/**
 * Pools tab content inside Lead Settings. Lists all counselor pools for the
 * institute with a "Create Pool" button. Clicking a pool navigates to the
 * full-page editor at /settings/leads/pools/$poolId.
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MyButton } from '@/components/design-system/button';
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
import {
    AssignmentMode,
    CounselorPoolDTO,
    useCounselorPools,
    useDeletePool,
} from '@/services/counselor-pool';

const MODE_LABEL: Record<AssignmentMode, string> = {
    MANUAL: 'Manual',
    ROUND_ROBIN: 'Round-robin',
    TIME_BASED: 'Time-based',
};

const MODE_TONE: Record<AssignmentMode, string> = {
    MANUAL: 'bg-neutral-100 text-neutral-700',
    ROUND_ROBIN: 'bg-blue-100 text-blue-700',
    TIME_BASED: 'bg-purple-100 text-purple-700',
};

export default function PoolsList() {
    const navigate = useNavigate();
    const { data: pools, isLoading } = useCounselorPools();
    const { mutate: deletePool, isPending: deleting } = useDeletePool();
    const [poolToDelete, setPoolToDelete] = useState<CounselorPoolDTO | null>(null);

    // Routes are new and not yet picked up by routeTree.gen.ts at type-check time;
    // cast keeps the build green until the generator regenerates the tree.
    const goToCreate = () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        navigate({ to: '/settings/leads/pools/$poolId', params: { poolId: 'new' } } as any);

    const goToEdit = (poolId: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        navigate({ to: '/settings/leads/pools/$poolId', params: { poolId } } as any);

    const confirmDelete = () => {
        if (!poolToDelete) return;
        deletePool(poolToDelete.id, {
            onSuccess: () => {
                toast.success(`Pool "${poolToDelete.name}" deleted`);
                setPoolToDelete(null);
            },
            onError: (err: unknown) => {
                const message =
                    (err as { response?: { data?: { ex?: string; message?: string } } })?.response
                        ?.data?.ex ??
                    (err as { response?: { data?: { message?: string } } })?.response?.data
                        ?.message ??
                    'Failed to delete pool';
                toast.error(message);
            },
        });
    };

    if (isLoading) {
        return <div className="p-6 text-sm text-muted-foreground">Loading pools…</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Counselor Pools</h3>
                    <p className="text-sm text-muted-foreground">
                        A pool groups counselors and decides how leads from its campaigns get
                        auto-assigned. Each campaign can belong to only one pool.
                    </p>
                </div>
                <MyButton buttonType="primary" scale="medium" onClick={goToCreate}>
                    + Create Pool
                </MyButton>
            </div>

            {pools && pools.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12">
                        <p className="text-sm text-muted-foreground">
                            No pools yet. Create your first pool to start auto-assigning leads.
                        </p>
                        <MyButton buttonType="primary" scale="medium" onClick={goToCreate}>
                            Create Pool
                        </MyButton>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {pools?.map((pool) => (
                        <Card
                            key={pool.id}
                            className="cursor-pointer transition hover:shadow-md"
                            onClick={() => goToEdit(pool.id)}
                        >
                            <CardContent className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="truncate font-medium">{pool.name}</h4>
                                        {pool.description && (
                                            <p className="line-clamp-2 text-xs text-muted-foreground">
                                                {pool.description}
                                            </p>
                                        )}
                                    </div>
                                    <Badge className={MODE_TONE[pool.assignment_mode]}>
                                        {MODE_LABEL[pool.assignment_mode]}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{pool.audiences?.length ?? 0} campaigns</span>
                                    <span>·</span>
                                    <span>
                                        {countDistinctCounselors(pool.members)} counselors
                                    </span>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        className="text-xs text-red-600 hover:underline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPoolToDelete(pool);
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <AlertDialog
                open={!!poolToDelete}
                onOpenChange={(open) => !open && setPoolToDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete pool "{poolToDelete?.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes the pool, its shift schedule, and all member
                            configuration. Counselors assigned to existing leads are not affected;
                            new leads on this pool's campaigns will no longer be auto-assigned.
                            {poolToDelete?.audiences && poolToDelete.audiences.length > 0 && (
                                <span className="mt-2 block text-amber-600">
                                    This pool still has {poolToDelete.audiences.length} campaign
                                    {poolToDelete.audiences.length === 1 ? '' : 's'} attached. You
                                    must remove all campaigns from the pool first.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={
                                deleting ||
                                !!(poolToDelete?.audiences && poolToDelete.audiences.length > 0)
                            }
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleting ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function countDistinctCounselors(members?: { counselor_user_id: string }[]) {
    if (!members) return 0;
    return new Set(members.map((m) => m.counselor_user_id)).size;
}
