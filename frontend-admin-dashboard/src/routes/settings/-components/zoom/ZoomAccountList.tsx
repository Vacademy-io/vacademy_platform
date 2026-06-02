import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle, WarningCircle, Star, DotsThreeVertical, Trash, Pencil, Lightning } from '@phosphor-icons/react';

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
import {
    deleteZoomAccount,
    setDefaultZoomAccount,
    testZoomConnection,
    type ZoomAccountSummary,
} from '@/services/zoom-accounts';

interface Props {
    accounts: ZoomAccountSummary[];
    onChanged: () => void;
    onEdit: (account: ZoomAccountSummary) => void;
}

/**
 * Compact list of registered Zoom accounts with per-row actions:
 * Set default · Test connection · Edit · Delete.
 */
export function ZoomAccountList({ accounts, onChanged, onEdit }: Props) {
    const [pendingDelete, setPendingDelete] = useState<ZoomAccountSummary | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    if (accounts.length === 0) {
        return (
            <div className="rounded-md border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
                No Zoom accounts registered yet. Add one to enable Zoom meetings for this institute.
            </div>
        );
    }

    const onSetDefault = async (a: ZoomAccountSummary) => {
        if (a.isDefault) return;
        setBusyId(a.id);
        try {
            await setDefaultZoomAccount(a.id);
            toast.success(`"${a.label}" is now the default Zoom account`);
            onChanged();
        } catch {
            toast.error('Could not set default');
        } finally {
            setBusyId(null);
        }
    };

    const onTest = async (a: ZoomAccountSummary) => {
        setBusyId(a.id);
        try {
            const r = await testZoomConnection(a.id);
            if (r.ok) {
                toast.success(
                    `Connected as ${r.accountEmail ?? 'unknown'}` +
                        (r.planType ? ` (${r.planType})` : '')
                );
                onChanged();
            } else {
                toast.error(r.error ?? 'Connection failed');
            }
        } catch {
            toast.error('Connection test failed');
        } finally {
            setBusyId(null);
        }
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setBusyId(pendingDelete.id);
        try {
            await deleteZoomAccount(pendingDelete.id);
            toast.success(`Removed "${pendingDelete.label}"`);
            onChanged();
        } catch {
            toast.error('Failed to delete account');
        } finally {
            setBusyId(null);
            setPendingDelete(null);
        }
    };

    return (
        <>
            <div className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
                {accounts.map((a) => (
                    <div
                        key={a.id}
                        className="flex items-center gap-3 p-3 first:rounded-t-md last:rounded-b-md hover:bg-neutral-50/60"
                    >
                        <StatusBadge status={a.status} />

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-neutral-800">
                                    {a.label}
                                </span>
                                {a.isDefault && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                        <Star size={12} weight="fill" /> Default
                                    </span>
                                )}
                                {!a.webhookConfigured && (
                                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
                                        Webhook not set
                                    </span>
                                )}
                            </div>
                            <div className="mt-0.5 text-xs text-neutral-500">
                                Account&nbsp;{a.zoomAccountIdMasked} · S2S&nbsp;{a.s2sClientIdMasked} ·
                                SDK&nbsp;{a.sdkClientKeyMasked}
                                {a.lastVerifiedAt && (
                                    <> · last verified {formatDate(a.lastVerifiedAt)}</>
                                )}
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    disabled={busyId === a.id}
                                    aria-label="Account actions"
                                >
                                    <DotsThreeVertical size={18} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onSelect={() => onTest(a)}>
                                    <Lightning size={14} className="mr-2" /> Test connection
                                </DropdownMenuItem>
                                {!a.isDefault && (
                                    <DropdownMenuItem onSelect={() => onSetDefault(a)}>
                                        <Star size={14} className="mr-2" /> Set as default
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => onEdit(a)}>
                                    <Pencil size={14} className="mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={() => setPendingDelete(a)}
                                    className="text-red-600 focus:text-red-700"
                                >
                                    <Trash size={14} className="mr-2" /> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}
            </div>

            <AlertDialog
                open={pendingDelete !== null}
                onOpenChange={(o) => (!o ? setPendingDelete(null) : undefined)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this Zoom account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{pendingDelete?.label}" will be removed. Existing live sessions that
                            were created with this account remain unaffected, but you will not be
                            able to create new meetings against it until you re-add the credentials.
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
        </>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'ACTIVE') {
        return (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle size={16} weight="fill" />
            </span>
        );
    }
    return (
        <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600"
            title={status}
        >
            <WarningCircle size={16} weight="fill" />
        </span>
    );
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}
