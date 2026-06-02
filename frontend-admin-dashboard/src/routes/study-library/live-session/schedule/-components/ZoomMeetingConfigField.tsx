import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type Control, type UseFormSetValue, useWatch } from 'react-hook-form';
import { Info } from '@phosphor-icons/react';

import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { listZoomAccounts } from '@/services/zoom-accounts';

/**
 * Step-1 sub-form shown when the admin picks the Zoom platform.
 *
 * Renders the full set of Zoom create-meeting settings, grouped:
 *  - Account picker
 *  - Entry & security (waiting room, join before host, auth, approval, alt-hosts)
 *  - Audio / Video defaults
 *  - In-meeting features (recording, breakout, focus mode, watermark, multi-device)
 *
 * Field names mirror the Zoom REST API "settings" object — the backend's
 * ZoomMeetingManager.buildSettings re-keys to snake_case before sending.
 */
export function ZoomMeetingConfigField({
    control,
    setValue,
}: {
    control: Control<any>;
    setValue: UseFormSetValue<any>;
}) {
    const selectedAccountId = useWatch({ control, name: 'zoomAccountId' });

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['zoom-accounts'],
        queryFn: listZoomAccounts,
        staleTime: 60_000,
    });

    const activeAccounts = accounts.filter((a) => a.status === 'ACTIVE');

    // Preselect the default account once data loads.
    useEffect(() => {
        if (selectedAccountId || activeAccounts.length === 0) return;
        const preferred =
            activeAccounts.find((a) => a.isDefault)?.id ?? activeAccounts[0]?.id;
        if (preferred) {
            setValue('zoomAccountId', preferred, { shouldDirty: false });
        }
    }, [selectedAccountId, activeAccounts, setValue]);

    if (isLoading) {
        return (
            <div className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-400">
                Loading Zoom accounts…
            </div>
        );
    }

    if (activeAccounts.length === 0) {
        return (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800">
                <Info size={16} className="mt-0.5 shrink-0" />
                <div>
                    Zoom integration isn&apos;t set up for this institute. Add a Zoom account under{' '}
                    <strong>Settings → Live Session → Zoom Integration</strong>, or paste a meeting
                    link in the Live Class Link field below.
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-primary-200 bg-primary-50/30 p-4">
            <h4 className="mb-3 text-sm font-semibold">Zoom Meeting Settings</h4>

            {/* Account picker */}
            <FormField
                control={control}
                name="zoomAccountId"
                render={({ field }) => (
                    <FormItem className="mb-4">
                        <FormLabel className="text-sm font-normal">Zoom account</FormLabel>
                        <FormControl>
                            <select
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-72"
                            >
                                {activeAccounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.label}
                                        {a.isDefault ? ' (default)' : ''}
                                    </option>
                                ))}
                            </select>
                        </FormControl>
                    </FormItem>
                )}
            />

            <Section title="Entry & security">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ToggleField
                        control={control}
                        name="zoomWaitingRoom"
                        label="Enable waiting room"
                        dflt={true}
                    />
                    <ToggleField
                        control={control}
                        name="zoomJoinBeforeHost"
                        label="Allow join before host"
                        dflt={false}
                    />
                    <ToggleField
                        control={control}
                        name="zoomMeetingAuthentication"
                        label="Require Zoom login to join"
                        dflt={false}
                    />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        control={control}
                        name="zoomApprovalType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-normal">
                                    Registration approval
                                </FormLabel>
                                <FormControl>
                                    <select
                                        value={field.value ?? '2'}
                                        onChange={field.onChange}
                                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    >
                                        <option value="2">No registration required</option>
                                        <option value="0">Automatically approve</option>
                                        <option value="1">Manually approve</option>
                                    </select>
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name="zoomAlternativeHosts"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-normal">
                                    Alternative hosts (comma-separated emails)
                                </FormLabel>
                                <FormControl>
                                    <input
                                        type="text"
                                        value={field.value ?? ''}
                                        onChange={field.onChange}
                                        placeholder="e.g. cohost1@inst.edu, cohost2@inst.edu"
                                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
            </Section>

            <Section title="Audio / Video defaults">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ToggleField
                        control={control}
                        name="zoomMuteUponEntry"
                        label="Mute participants on entry"
                        dflt={true}
                    />
                    <ToggleField
                        control={control}
                        name="zoomHostVideo"
                        label="Start host video on"
                        dflt={false}
                    />
                    <ToggleField
                        control={control}
                        name="zoomParticipantVideo"
                        label="Start participant video on"
                        dflt={false}
                    />
                </div>
                <div className="mt-3">
                    <FormField
                        control={control}
                        name="zoomAudio"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-normal">Audio</FormLabel>
                                <FormControl>
                                    <select
                                        value={field.value ?? 'both'}
                                        onChange={field.onChange}
                                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-64"
                                    >
                                        <option value="both">Computer + Telephony</option>
                                        <option value="voip">Computer audio only</option>
                                        <option value="telephony">Telephony only</option>
                                    </select>
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
            </Section>

            <Section title="In-meeting features">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ToggleField
                        control={control}
                        name="zoomBreakoutRoom"
                        label="Enable breakout rooms"
                        dflt={false}
                    />
                    <ToggleField
                        control={control}
                        name="zoomFocusMode"
                        label="Start in focus mode"
                        dflt={false}
                    />
                    <ToggleField
                        control={control}
                        name="zoomAllowMultipleDevices"
                        label="Allow join from multiple devices"
                        dflt={false}
                    />
                    <ToggleField
                        control={control}
                        name="zoomWatermark"
                        label="Add identity watermark"
                        dflt={false}
                    />
                </div>
                <div className="mt-3">
                    <FormField
                        control={control}
                        name="zoomAutoRecording"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-normal">
                                    Automatic recording
                                </FormLabel>
                                <FormControl>
                                    <select
                                        value={field.value ?? 'cloud'}
                                        onChange={field.onChange}
                                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-64"
                                    >
                                        <option value="cloud">Record to Zoom cloud</option>
                                        <option value="local">
                                            Local recording (host machine)
                                        </option>
                                        <option value="none">Don&apos;t record</option>
                                    </select>
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
            </Section>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mt-4 rounded-md border border-neutral-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {title}
            </div>
            {children}
        </div>
    );
}

function ToggleField({
    control,
    name,
    label,
    dflt,
}: {
    control: Control<any>;
    name: string;
    label: string;
    dflt: boolean;
}) {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                        <input
                            type="checkbox"
                            checked={field.value ?? dflt}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="size-4 rounded border-gray-300"
                        />
                    </FormControl>
                    <FormLabel className="text-sm font-normal">{label}</FormLabel>
                </FormItem>
            )}
        />
    );
}
