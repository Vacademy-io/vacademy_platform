import { useMemo } from 'react';
import { MyButton } from '@/components/design-system/button';
import { EnvelopeSimple, WhatsappLogo } from '@phosphor-icons/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { USER_ANNOUNCEMENT_PREFERENCES } from '@/constants/urls';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getTokenFromCookie, getUserRoles } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { cn } from '@/lib/utils';

// Two admin-only buttons to (un)subscribe this user from promotional Email /
// WhatsApp. Reuses the notification-service preference API, which also cascades
// to the audience opt-out. Each button: spinner while the call is in flight,
// then a red "Unsubscribed" state once the server confirms (200).

interface EmailSenderOption {
    emailType: string;
    fromAddress?: string;
}
interface PreferenceResponse {
    settings?: {
        email?: { globallyUnsubscribed?: boolean; senders?: { unsubscribed?: boolean }[] };
        whatsapp?: { unsubscribed?: boolean };
    };
    availableSenders?: { emailSenders?: EmailSenderOption[] };
}

export const UnsubscribeButtons = () => {
    const { selectedStudent } = useStudentSidebar();
    const { instituteDetails } = useInstituteDetailsStore();
    const queryClient = useQueryClient();

    const instituteId = instituteDetails?.id ?? '';
    // Leads have no username; key by email (the identifier they always carry).
    const identifier = selectedStudent?.username || selectedStudent?.email || '';
    const isAdmin = getUserRoles(getTokenFromCookie(TokenKey.accessToken)).includes('ADMIN');

    const prefKey = ['announcement-preferences', identifier, instituteId];

    const { data, isLoading } = useQuery({
        queryKey: prefKey,
        queryFn: async (): Promise<PreferenceResponse> => {
            const res = await authenticatedAxiosInstance.get(
                USER_ANNOUNCEMENT_PREFERENCES(identifier),
                { params: { instituteId } }
            );
            return res.data;
        },
        enabled: isAdmin && !!identifier && !!instituteId,
    });

    const emailSenders = useMemo(
        () => data?.availableSenders?.emailSenders ?? [],
        [data]
    );
    const emailUnsubscribed =
        !!data?.settings?.email?.globallyUnsubscribed ||
        (!!data?.settings?.email?.senders?.length &&
            data.settings.email.senders.every((s) => s.unsubscribed));
    const whatsappUnsubscribed = !!data?.settings?.whatsapp?.unsubscribed;

    const updatePref = useMutation({
        mutationFn: (body: Record<string, unknown>) =>
            authenticatedAxiosInstance.put(USER_ANNOUNCEMENT_PREFERENCES(identifier), body, {
                params: { instituteId },
            }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: prefKey }),
        onError: () => toast.error('Could not update preference'),
    });

    const toggleEmail = () =>
        updatePref.mutate({
            preferences: {
                emailSenders: emailSenders.map((s) => ({
                    emailType: s.emailType,
                    unsubscribed: !emailUnsubscribed,
                })),
            },
        });

    const toggleWhatsapp = () =>
        updatePref.mutate({ preferences: { whatsappUnsubscribed: !whatsappUnsubscribed } });

    if (!selectedStudent || !isAdmin || !identifier) return null;

    const pendingChannel = updatePref.isPending
        ? ((updatePref.variables as { preferences?: { whatsappUnsubscribed?: unknown } })
              ?.preferences?.whatsappUnsubscribed !== undefined
              ? 'whatsapp'
              : 'email')
        : null;

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-sm font-semibold text-neutral-900">Promotional messages</p>
            <p className="text-xs text-neutral-500">
                Stop sending marketing Email / WhatsApp to this person.
            </p>
            {isLoading ? (
                <div className="flex h-9 items-center">
                    <DashboardLoader />
                </div>
            ) : (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        disable={updatePref.isPending}
                        onClick={toggleEmail}
                        className={cn(
                            emailUnsubscribed && '!border-danger-200 !text-danger-600 hover:!bg-danger-50'
                        )}
                    >
                        {pendingChannel === 'email' ? (
                            <DashboardLoader size={16} />
                        ) : (
                            <EnvelopeSimple className="size-3.5" />
                        )}
                        {emailUnsubscribed ? 'Email unsubscribed' : 'Unsubscribe from Email'}
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        disable={updatePref.isPending}
                        onClick={toggleWhatsapp}
                        className={cn(
                            whatsappUnsubscribed &&
                                '!border-danger-200 !text-danger-600 hover:!bg-danger-50'
                        )}
                    >
                        {pendingChannel === 'whatsapp' ? (
                            <DashboardLoader size={16} />
                        ) : (
                            <WhatsappLogo className="size-3.5" />
                        )}
                        {whatsappUnsubscribed ? 'WhatsApp unsubscribed' : 'Unsubscribe from WhatsApp'}
                    </MyButton>
                </div>
            )}
        </div>
    );
};
