import { useState } from 'react';
import { toast } from 'sonner';
import {
    CheckCircle,
    WarningCircle,
    Star,
    DotsThreeVertical,
    Lightning,
    VideoCamera,
    LockOpen,
    Lock,
    LinkBreak,
} from '@phosphor-icons/react';

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
    disconnectGoogleAccount,
    setDefaultGoogleAccount,
    testGoogleConnection,
    updateGoogleAccountSettings,
    type GoogleAccountSummary,
} from '@/services/google-accounts';

interface Props {
    accounts: GoogleAccountSummary[];
    onChanged: () => void;
}

/**
 * Compact list of connected Google Workspace accounts with per-row actions:
 * Test connection · Set default · Toggle auto-recording · Join access (Open/Trusted) · Disconnect.
 */
export function GoogleAccountList({ accounts, onChanged }: Props) {
    const [pendingDisconnect, setPendingDisconnect] = useState<GoogleAccountSummary | null>(null);
    const [pendingOpenAccess, setPendingOpenAccess] = useState<GoogleAccountSummary | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    if (accounts.length === 0) {
        return (
            <div className="rounded-md border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
                No Google Workspace account connected yet. Click “Connect Google Workspace” to enable
                Google Meet for this institute.
            </div>
        );
    }

    const runUpdate = async (a: GoogleAccountSummary, fn: () => Promise<unknown>, ok: string) => {
        setBusyId(a.id);
        try {
            await fn();
            toast.success(ok);
            onChanged();
        } catch {
            toast.error('Could not update the account');
        } finally {
            setBusyId(null);
        }
    };

    const onTest = async (a: GoogleAccountSummary) => {
        setBusyId(a.id);
        try {
            const r = await testGoogleConnection(a.id);
            if (r.ok) {
                toast.success(`Connected as ${r.accountEmail ?? a.organizerEmail}`);
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

    const confirmDisconnect = async () => {
        if (!pendingDisconnect) return;
        const a = pendingDisconnect;
        setBusyId(a.id);
        try {
            await disconnectGoogleAccount(a.id);
            toast.success(`Disconnected ${a.organizerEmail}`);
            onChanged();
        } catch {
            toast.error('Failed to disconnect');
        } finally {
            setBusyId(null);
            setPendingDisconnect(null);
        }
    };

    const confirmOpenAccess = async () => {
        if (!pendingOpenAccess) return;
        const a = pendingOpenAccess;
        setPendingOpenAccess(null);
        await runUpdate(
            a,
            () => updateGoogleAccountSettings(a.id, { defaultAccessType: 'OPEN' }),
            'New meetings will use open join (anyone with the link)'
        );
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
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-medium text-neutral-800">
                                    {a.organizerEmail}
                                </span>
                                {a.isDefault && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                        <Star size={12} weight="fill" /> Default
                                    </span>
                                )}
                                {a.recordingEnabled && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-600">
                                        <VideoCamera size={12} /> Auto-record
                                    </span>
                                )}
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                                    {accessLabel(a.defaultAccessType)}
                                </span>
                                {a.status === 'RECONNECT_NEEDED' && (
                                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                                        Reconnect needed
                                    </span>
                                )}
                            </div>
                            <div className="mt-0.5 text-xs text-neutral-500">
                                {a.label}
                                {a.lastVerifiedAt && <> · last verified {formatDate(a.lastVerifiedAt)}</>}
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
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onSelect={() => onTest(a)}>
                                    <Lightning size={14} className="mr-2" /> Test connection
                                </DropdownMenuItem>
                                {!a.isDefault && (
                                    <DropdownMenuItem
                                        onSelect={() =>
                                            runUpdate(
                                                a,
                                                () => setDefaultGoogleAccount(a.id),
                                                `${a.organizerEmail} is now the default`
                                            )
                                        }
                                    >
                                        <Star size={14} className="mr-2" /> Set as default
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    onSelect={() =>
                                        runUpdate(
                                            a,
                                            () =>
                                                updateGoogleAccountSettings(a.id, {
                                                    recordingEnabled: !a.recordingEnabled,
                                                }),
                                            a.recordingEnabled
                                                ? 'Auto-recording disabled'
                                                : 'Auto-recording enabled (needs a recording-capable Workspace edition)'
                                        )
                                    }
                                >
                                    <VideoCamera size={14} className="mr-2" />
                                    {a.recordingEnabled ? 'Disable auto-recording' : 'Enable auto-recording'}
                                </DropdownMenuItem>
                                {a.defaultAccessType === 'OPEN' ? (
                                    <DropdownMenuItem
                                        onSelect={() =>
                                            runUpdate(
                                                a,
                                                () =>
                                                    updateGoogleAccountSettings(a.id, {
                                                        defaultAccessType: 'TRUSTED',
                                                    }),
                                                'New meetings will require guests to knock'
                                            )
                                        }
                                    >
                                        <Lock size={14} className="mr-2" /> Require knock (Trusted)
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem onSelect={() => setPendingOpenAccess(a)}>
                                        <LockOpen size={14} className="mr-2" /> Allow open join…
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    onSelect={() => setPendingDisconnect(a)}
                                    className="text-red-600 focus:text-red-700"
                                >
                                    <LinkBreak size={14} className="mr-2" /> Disconnect
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}
            </div>

            <AlertDialog
                open={pendingDisconnect !== null}
                onOpenChange={(o) => (!o ? setPendingDisconnect(null) : undefined)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Google Workspace?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDisconnect?.organizerEmail} will be disconnected and its access
                            revoked. Existing live sessions remain unaffected, but you won’t be able to
                            create new Google Meet sessions until you reconnect.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDisconnect}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Disconnect
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={pendingOpenAccess !== null}
                onOpenChange={(o) => (!o ? setPendingOpenAccess(null) : undefined)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Allow open join?</AlertDialogTitle>
                        <AlertDialogDescription>
                            With open join, <strong>anyone who has the meeting link can join without
                            knocking</strong> — a Google Meet link is a plain URL with no passcode. Use
                            this only if you’re comfortable that the link is shared solely with enrolled
                            learners through Vacademy. You can switch back to “require knock” anytime.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmOpenAccess}>
                            Allow open join
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function accessLabel(accessType: string): string {
    switch (accessType) {
        case 'OPEN':
            return 'Open join';
        case 'RESTRICTED':
            return 'Restricted';
        default:
            return 'Knock to join';
    }
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
