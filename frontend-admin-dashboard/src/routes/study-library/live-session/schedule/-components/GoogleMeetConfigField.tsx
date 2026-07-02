import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type Control, type UseFormSetValue, useWatch } from 'react-hook-form';
import { Info } from '@phosphor-icons/react';

import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { listGoogleAccounts } from '@/services/google-accounts';

/**
 * Step-1 sub-form shown when the admin picks the Google Meet platform.
 *
 * Google Meet has no per-meeting settings object (no embed SDK; recording + access are
 * institute-level account settings), so this is just an account picker + a note. When a connected
 * account is chosen the backend auto-generates a Meet space (no pasted link); when none is
 * connected the admin pastes a link as before. Mirrors {@code ZoomMeetingConfigField}'s account
 * picker.
 */
export function GoogleMeetConfigField({
    control,
    setValue,
}: {
    control: Control<any>;
    setValue: UseFormSetValue<any>;
}) {
    const selectedAccountId = useWatch({ control, name: 'googleMeetAccountId' });

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['google-accounts'],
        queryFn: listGoogleAccounts,
        staleTime: 60_000,
    });

    const activeAccounts = accounts.filter((a) => a.status === 'ACTIVE');

    // Preselect the default (or only) account once data loads.
    useEffect(() => {
        if (selectedAccountId || activeAccounts.length === 0) return;
        const preferred = activeAccounts.find((a) => a.isDefault)?.id ?? activeAccounts[0]?.id;
        if (preferred) {
            setValue('googleMeetAccountId', preferred, { shouldDirty: false });
        }
    }, [selectedAccountId, activeAccounts, setValue]);

    if (isLoading) {
        return (
            <div className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-400">
                Loading Google accounts…
            </div>
        );
    }

    if (activeAccounts.length === 0) {
        return (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800">
                <Info size={16} className="mt-0.5 shrink-0" />
                <div>
                    Google Meet integration isn&apos;t set up for this institute. Connect a Google
                    Workspace account under{' '}
                    <strong>Settings → Live Session → Google Meet Integration</strong>, or paste a
                    meeting link in the Live Class Link field below.
                </div>
            </div>
        );
    }

    const selected = activeAccounts.find((a) => a.id === selectedAccountId);

    return (
        <div className="rounded-lg border border-primary-200 bg-primary-50/30 p-4">
            <h4 className="mb-3 text-sm font-semibold">Google Meet Settings</h4>

            {/* Account picker */}
            <FormField
                control={control}
                name="googleMeetAccountId"
                render={({ field }) => (
                    <FormItem className="mb-3">
                        <FormLabel className="text-sm font-normal">Google account (organizer)</FormLabel>
                        <FormControl>
                            <select
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-72"
                            >
                                {activeAccounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.organizerEmail}
                                        {a.isDefault ? ' (default)' : ''}
                                    </option>
                                ))}
                            </select>
                        </FormControl>
                    </FormItem>
                )}
            />

            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800">
                <Info size={14} className="mt-0.5 shrink-0" />
                <div className="leading-relaxed">
                    A Google Meet link is created on this account.{' '}
                    {selected?.defaultAccessType === 'OPEN'
                        ? 'Anyone with the link joins (no knocking) — best for learners.'
                        : 'Guests must knock and the host admits each one.'}{' '}
                    {selected?.recordingEnabled
                        ? 'Auto-recording is ON — a teacher signed into the institute’s Workspace must be present.'
                        : 'Auto-recording is OFF.'}{' '}
                    Manage join-access and recording per account under Settings → Live Session →
                    Google Meet Integration.
                </div>
            </div>
        </div>
    );
}
