import { createFileRoute } from '@tanstack/react-router';

type EmailCampaigningSearch = {
    id?: string;
};

export const Route = createFileRoute('/announcement/email-campaigning/')({
    validateSearch: (search: Record<string, unknown>): EmailCampaigningSearch => ({
        id: typeof search.id === 'string' ? search.id : undefined,
    }),
});
