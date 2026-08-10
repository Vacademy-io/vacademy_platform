import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { CloudArrowDown, DownloadSimple, Devices } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
    getOfflineDiscrepancies,
    getOfflineDownloadTelemetry,
    reviewOfflineDiscrepancy,
} from '@/services/offline-access';
import type { OfflineDownloadTelemetryDTO, OfflineSyncDiscrepancyDTO } from '@/types/offline-access';
import { OfflineAvailabilityDialog } from './OfflineAvailabilityDialog';

interface OfflineTelemetryCardProps {
    packageSessionId: string;
}

/** Offline plan Part A4/A5: batch-level download telemetry + discrepancy review. */
export const OfflineTelemetryCard: React.FC<OfflineTelemetryCardProps> = ({ packageSessionId }) => {
    const [telemetry, setTelemetry] = useState<OfflineDownloadTelemetryDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [discrepancyDialogOpen, setDiscrepancyDialogOpen] = useState(false);
    const [batchAvailabilityOpen, setBatchAvailabilityOpen] = useState(false);

    useEffect(() => {
        if (!packageSessionId) return;
        let active = true;
        setLoading(true);
        getOfflineDownloadTelemetry(packageSessionId)
            .then((data) => active && setTelemetry(data))
            .catch(() => active && setTelemetry(null))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [packageSessionId]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CloudArrowDown className="size-5 text-primary-500" />
                    Offline Downloads
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 rounded-lg border border-neutral-100 p-3">
                        <DownloadSimple className="size-5 text-primary-500" />
                        <div>
                            <div className="text-h2 font-semibold">
                                {loading ? '—' : (telemetry?.learners_with_downloads ?? 0)}
                            </div>
                            <div className="text-caption text-neutral-500">Learners with downloads</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-neutral-100 p-3">
                        <Devices className="size-5 text-primary-500" />
                        <div>
                            <div className="text-h2 font-semibold">
                                {loading ? '—' : (telemetry?.active_devices ?? 0)}
                            </div>
                            <div className="text-caption text-neutral-500">Active offline devices</div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => setBatchAvailabilityOpen(true)}
                    >
                        Manage batch offline availability
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => setDiscrepancyDialogOpen(true)}
                    >
                        Review sync discrepancies
                    </MyButton>
                </div>
            </CardContent>

            <DiscrepancyReviewDialog
                open={discrepancyDialogOpen}
                onClose={() => setDiscrepancyDialogOpen(false)}
                packageSessionId={packageSessionId}
            />

            {batchAvailabilityOpen && (
                <OfflineAvailabilityDialog
                    open={batchAvailabilityOpen}
                    onClose={() => setBatchAvailabilityOpen(false)}
                    sourceType="PACKAGE_SESSION"
                    sourceId={packageSessionId}
                    packageSessionId={packageSessionId}
                    nodeName="this batch"
                />
            )}
        </Card>
    );
};

interface DiscrepancyReviewDialogProps {
    open: boolean;
    onClose: () => void;
    packageSessionId: string;
}

function DiscrepancyReviewDialog({ open, onClose, packageSessionId }: DiscrepancyReviewDialogProps) {
    const [rows, setRows] = useState<OfflineSyncDiscrepancyDTO[]>([]);
    const [loading, setLoading] = useState(false);

    const load = () => {
        setLoading(true);
        getOfflineDiscrepancies(packageSessionId, 'OPEN')
            .then((page) => setRows(page.content))
            .catch(() => toast.error('Failed to load discrepancies'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (open) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleReview = async (id: string) => {
        try {
            await reviewOfflineDiscrepancy(id);
            setRows((prev) => prev.filter((r) => r.id !== id));
            toast.success('Marked as reviewed');
        } catch {
            toast.error('Failed to update discrepancy');
        }
    };

    return (
        <MyDialog open={open} onOpenChange={onClose} heading="Offline Sync Discrepancies" dialogWidth="max-w-3xl">
            <div className="space-y-4 p-1">
                <p className="text-caption text-neutral-500">
                    Client-reported values that didn&apos;t match the server after re-scoring an
                    offline quiz/question submission (client value is what the device computed
                    offline; server value is authoritative and already applied).
                </p>
                {loading ? (
                    <div className="py-8 text-center text-sm text-neutral-500">Loading…</div>
                ) : rows.length === 0 ? (
                    <div className="py-8 text-center text-sm text-neutral-500">
                        No open discrepancies for this batch.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-neutral-100">
                        <table className="w-full text-left text-body">
                            <thead className="bg-neutral-50 text-caption text-neutral-500">
                                <tr>
                                    <th className="p-3">Field</th>
                                    <th className="p-3">Client value</th>
                                    <th className="p-3">Server value</th>
                                    <th className="p-3">Created</th>
                                    <th className="p-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className="border-t border-neutral-100">
                                        <td className="p-3">{row.field}</td>
                                        <td className="p-3 text-danger-600">{row.client_value}</td>
                                        <td className="p-3 text-success-600">{row.server_value}</td>
                                        <td className="p-3 text-caption text-neutral-500">
                                            {new Date(row.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-3">
                                            <MyButton
                                                buttonType="secondary"
                                                scale="small"
                                                onClick={() => handleReview(row.id)}
                                            >
                                                Mark reviewed
                                            </MyButton>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="flex justify-end border-t pt-4">
                    <MyButton buttonType="secondary" onClick={onClose}>
                        Close
                    </MyButton>
                </div>
            </div>
        </MyDialog>
    );
}
