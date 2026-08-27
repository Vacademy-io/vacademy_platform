import { SEND_LEARNER_CREDENTIALS, SHARE_CREDENTIALS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CredentialDeliveryMode } from '@/components/templates/CredentialDeliveryModePicker';
import type { TFunction } from 'i18next';

export interface ShareCredentialsParams {
    userIds: string[];
    /**
     * DEFAULT sends the platform's built-in credentials email — one call for the whole batch.
     * TEMPLATE renders the institute's own template, which is resolved per learner.
     */
    mode?: CredentialDeliveryMode;
    /** Only meaningful in TEMPLATE mode; omitted means the institute's standing binding. */
    templateId?: string;
}

export interface ShareCredentialsSummary {
    sent: number;
    failed: number;
    /** First backend explanation seen, so a wholly-failed batch can say why. */
    message?: string;
}

/**
 * TEMPLATE mode addresses one learner at a time (each message is rendered with that learner's
 * username and password), so a batch becomes N calls. They are run a few at a time rather than
 * all at once: fanning out an entire selection in parallel is what makes the shared DB pool time
 * out and report false failures for sends that actually went through.
 */
const TEMPLATE_SEND_CONCURRENCY = 4;

const sendWithTemplate = async (
    t: TFunction,
    userIds: string[],
    templateId?: string
): Promise<ShareCredentialsSummary> => {
    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error(t('manageStudentsShareCredentialsService:errors.instituteIdNotFound'));
    }

    let sent = 0;
    let failed = 0;
    let message: string | undefined;

    const queue = [...userIds];
    const worker = async () => {
        for (;;) {
            const userId = queue.shift();
            if (userId === undefined) return;
            try {
                const response = await authenticatedAxiosInstance.post(
                    SEND_LEARNER_CREDENTIALS,
                    null,
                    {
                        params: {
                            instituteId,
                            userId,
                            channels: 'EMAIL',
                            mode: 'TEMPLATE',
                            ...(templateId ? { templateId } : {}),
                        },
                    }
                );
                if (response.data?.sent_channels?.length) {
                    sent += 1;
                } else {
                    failed += 1;
                    message = message ?? response.data?.message;
                }
            } catch {
                failed += 1;
            }
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(TEMPLATE_SEND_CONCURRENCY, userIds.length) }, worker)
    );

    return { sent, failed, message };
};

/**
 * Takes the translation function rather than importing the i18next singleton — the only
 * caller is useShareCredentials below, which sources it from its own useTranslation() so
 * the 'manageStudentsShareCredentialsService' namespace is guaranteed to be loaded whenever
 * this runs.
 */
export const buildShareCredentials =
    (t: TFunction) =>
    async ({
        userIds,
        mode = 'DEFAULT',
        templateId,
    }: ShareCredentialsParams): Promise<ShareCredentialsSummary> => {
        if (mode === 'TEMPLATE') {
            return sendWithTemplate(t, userIds, templateId);
        }
        // The built-in mail takes the whole batch in one call — keep it that way.
        await authenticatedAxiosInstance.post(SHARE_CREDENTIALS, userIds);
        return { sent: userIds.length, failed: 0 };
    };

export const useShareCredentials = () => {
    const { t } = useTranslation(['manageStudentsShareCredentialsService']);
    return useMutation({
        mutationFn: buildShareCredentials(t),
    });
};
