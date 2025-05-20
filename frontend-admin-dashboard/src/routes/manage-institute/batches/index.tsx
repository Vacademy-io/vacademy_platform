import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { ManageBatches } from './-components/manage-batches';
import { createFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';

export const Route = createFileRoute('/manage-institute/batches/')({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <LayoutContainer>
            {/* <EmptyDashboard /> */}
            <Helmet>
                <title>Manage Batches</title>
                <meta name="description" content="This page contains the management of batches" />
            </Helmet>
            <ManageBatches />
        </LayoutContainer>
    );
}
