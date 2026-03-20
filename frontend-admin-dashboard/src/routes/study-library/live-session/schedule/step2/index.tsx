import { createFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import ScheduleStep2 from '../-components/scheduleStep2';
import { InitStudyLibraryProvider } from '@/providers/study-library/init-study-library-provider';

export const Route = createFileRoute('/study-library/live-session/schedule/step2/')({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <LayoutContainer>
            <Helmet>
                <title>Live Session</title>
                <meta name="step2" content="This page lets you schedule your live session" />
            </Helmet>
            <InitStudyLibraryProvider>
                <ScheduleStep2 />
            </InitStudyLibraryProvider>
        </LayoutContainer>
    );
}
