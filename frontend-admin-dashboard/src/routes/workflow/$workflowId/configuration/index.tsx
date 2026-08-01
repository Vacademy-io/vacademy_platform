import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * Shareable deep link to a workflow's Configuration tab:
 *   /workflow/<id>/configuration  →  /workflow/<id>?tab=configuration
 * Exists so admins can be sent a direct "edit your workflow here" URL.
 */
export const Route = createFileRoute('/workflow/$workflowId/configuration/')({
    beforeLoad: ({ params }) => {
        throw redirect({
            to: '/workflow/$workflowId',
            params: { workflowId: params.workflowId },
            search: { tab: 'configuration' },
        });
    },
});
