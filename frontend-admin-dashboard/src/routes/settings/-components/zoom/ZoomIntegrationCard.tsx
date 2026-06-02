import { useEffect, useState } from 'react';
import { VideoCamera, Plus, Info } from '@phosphor-icons/react';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { listZoomAccounts, type ZoomAccountSummary } from '@/services/zoom-accounts';
import { AddZoomAccountDialog } from './AddZoomAccountDialog';
import { ZoomAccountList } from './ZoomAccountList';

/**
 * Self-contained card for the Live Session Settings page that lets an institute
 * admin manage Zoom integration accounts. Data is loaded independently of the
 * surrounding LiveSessionSettings form (Zoom accounts persist via their own
 * REST endpoints, not the institute_setting JSON blob).
 */
export function ZoomIntegrationCard() {
    const [accounts, setAccounts] = useState<ZoomAccountSummary[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<ZoomAccountSummary | null>(null);

    const refresh = async () => {
        setError(null);
        try {
            const fresh = await listZoomAccounts();
            setAccounts(fresh);
        } catch (e) {
            console.error(e);
            setError('Failed to load Zoom accounts.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void refresh();
    }, []);

    const openCreate = () => {
        setEditTarget(null);
        setDialogOpen(true);
    };

    const openEdit = (a: ZoomAccountSummary) => {
        setEditTarget(a);
        setDialogOpen(true);
    };

    return (
        <Card className="border-neutral-200 shadow-none">
            <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                    <VideoCamera size={18} />
                </div>
                <div className="flex-1">
                    <CardTitle className="text-base">Zoom Integration</CardTitle>
                    <CardDescription>
                        Connect one or more Zoom accounts so admins can create Zoom meetings
                        directly from the live-class wizard, with learners joining seamlessly via
                        the embedded Meeting SDK.
                    </CardDescription>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={openCreate}
                    className="shrink-0"
                    disabled={loading}
                >
                    <Plus size={14} className="mr-1" />
                    Add Zoom account
                </Button>
            </CardHeader>

            <CardContent className="border-t border-neutral-100 p-5">
                {loading ? (
                    <div className="flex h-16 items-center justify-center text-neutral-400">
                        <Loader2 className="size-5 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}{' '}
                        <button
                            type="button"
                            className="ml-1 underline"
                            onClick={() => {
                                setLoading(true);
                                void refresh();
                            }}
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        <ZoomAccountList
                            accounts={accounts ?? []}
                            onChanged={refresh}
                            onEdit={openEdit}
                        />

                        <RetentionNotice />
                    </>
                )}
            </CardContent>

            <AddZoomAccountDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                mode={editTarget ? 'edit' : 'create'}
                account={editTarget}
                onSaved={refresh}
            />
        </Card>
    );
}

function RetentionNotice() {
    return (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800">
            <Info size={14} className="mt-0.5 shrink-0" />
            <div className="leading-relaxed">
                Zoom cloud recordings expire by default after <strong>30 days</strong> (then 30 days
                in trash before permanent deletion). To preserve recordings beyond that window,
                use "Sync to Vacademy S3" on each recording from the session view — coming in a
                future release. For now, the default Zoom retention applies; you can extend it
                from your Zoom account settings.
            </div>
        </div>
    );
}
