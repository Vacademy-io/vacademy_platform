import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/planning/')({
    beforeLoad: () => {
        throw redirect({
            to: `/planning/planning`,
            search: { packageSessionId: '' },
        });
    },
});
