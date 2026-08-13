import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MyButton } from '@/components/design-system/button';
import { StatusChips } from '@/components/design-system/chips';
import { MyDialog } from '@/components/design-system/dialog';
import { CloudArrowDown, DeviceMobile, Desktop } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { getOfflineDevicesForUser, revokeOfflineDevice } from '@/services/offline-access';
import type { OfflineDeviceDTO } from '@/types/offline-access';

/**
 * Admin view of a learner's registered offline devices (offline plan Part A3),
 * inside Portal Access ("who has access?"). Revoking a device makes the
 * learner app purge ALL its downloaded content and lose offline access at its
 * next online check-in — it does not change any course permissions.
 */
export const OfflineDevicesCard = ({ userId }: { userId: string }) => {
    const queryClient = useQueryClient();
    const [confirmDevice, setConfirmDevice] = useState<OfflineDeviceDTO | null>(null);

    const { data: devices, isLoading } = useQuery({
        queryKey: ['offline-devices', userId],
        queryFn: () => getOfflineDevicesForUser(userId),
        enabled: !!userId,
    });

    const { mutate: revoke, isPending: revoking } = useMutation({
        mutationFn: (deviceId: string) => revokeOfflineDevice(deviceId, 'Revoked by admin'),
        onSuccess: () => {
            toast.success('Device revoked — content purges at its next check-in');
            queryClient.invalidateQueries({ queryKey: ['offline-devices', userId] });
            setConfirmDevice(null);
        },
        onError: () => toast.error('Failed to revoke device'),
    });

    if (!userId) return null;

    const formatDate = (value?: string) =>
        value ? new Date(value).toLocaleDateString() : '—';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-body font-semibold">
                    <CloudArrowDown className="size-5 text-primary-500" />
                    Offline devices
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {isLoading ? (
                    <p className="text-caption text-neutral-500">Loading devices…</p>
                ) : !devices?.length ? (
                    <p className="text-caption text-neutral-500">
                        No devices registered for offline downloads.
                    </p>
                ) : (
                    devices.map((device) => (
                        <div
                            key={device.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 p-3"
                        >
                            <div className="flex items-center gap-3">
                                {device.platform === 'DESKTOP' ? (
                                    <Desktop className="size-5 text-neutral-500" />
                                ) : (
                                    <DeviceMobile className="size-5 text-neutral-500" />
                                )}
                                <div>
                                    <p className="text-body font-medium">
                                        {device.device_name || device.platform || 'Device'}
                                    </p>
                                    <p className="text-caption text-neutral-500">
                                        Last check-in {formatDate(device.last_checkin_at)} · offline
                                        access until {formatDate(device.lease_expires_at)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusChips
                                    status={device.status === 'ACTIVE' ? 'ACTIVE' : 'TERMINATED'}
                                    showIcon={false}
                                >
                                    {device.status === 'ACTIVE' ? 'Active' : 'Revoked'}
                                </StatusChips>
                                {device.status === 'ACTIVE' && (
                                    <MyButton
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() => setConfirmDevice(device)}
                                    >
                                        Revoke
                                    </MyButton>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </CardContent>

            <MyDialog
                heading="Revoke offline device?"
                open={!!confirmDevice}
                onOpenChange={(open) => !open && setConfirmDevice(null)}
                footer={
                    <div className="flex w-full justify-end gap-2">
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={() => setConfirmDevice(null)}
                            disabled={revoking}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            className="bg-danger-500 hover:bg-danger-600"
                            onClick={() => confirmDevice && revoke(confirmDevice.id)}
                            disabled={revoking}
                        >
                            {revoking ? 'Revoking…' : 'Revoke device'}
                        </MyButton>
                    </div>
                }
            >
                <p className="p-1 text-body text-neutral-600">
                    All downloaded content on{' '}
                    <span className="font-medium">
                        {confirmDevice?.device_name || 'this device'}
                    </span>{' '}
                    will be deleted the next time it comes online, and it will stop counting
                    against the learner&apos;s device limit. Course permissions are unaffected.
                </p>
            </MyDialog>
        </Card>
    );
};
