import { createFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { useEffect } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import FeedbackListPage from './-components/feedback-list-page';

export const Route = createFileRoute('/study-library/live-session/feedback/')({
    component: RouteComponent,
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading('Live Class Feedback');
    }, [setNavHeading]);

    return (
        <LayoutContainer>
            <Helmet>
                <title>Live Class Feedback</title>
                <meta
                    name="description"
                    content="Review learner feedback across all live classes, filtered by batch, subject and date range."
                />
            </Helmet>
            <FeedbackListPage />
        </LayoutContainer>
    );
}
