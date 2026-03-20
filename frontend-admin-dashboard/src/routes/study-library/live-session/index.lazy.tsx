import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import SessionListPage from './-components/sessions-list-page';

export const Route = createLazyFileRoute('/study-library/live-session/')({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <LayoutContainer>
            <Helmet>
                <title>Live Session</title>
                <meta
                    name="description"
                    content="This page shows the live session list of the institute."
                />
            </Helmet>
            <SessionListPage />
        </LayoutContainer>
    );
}
