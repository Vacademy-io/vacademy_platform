import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { SessionsPage } from './-components/sessionsPage';
import { Helmet } from 'react-helmet';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';

export const Route = createLazyFileRoute('/manage-institute/sessions/')({
    component: RouteComponent,
});

const heading = (
    <div className="flex items-center gap-4">
        <div>Learning Center</div>
    </div>
);

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(heading);
    }, []);
    return (
        <LayoutContainer>
            <Helmet>
                <title>Session</title>
                <meta
                    name="description"
                    content="This page shows the study library of the institute."
                />
            </Helmet>
            <SessionsPage />
        </LayoutContainer>
    );
}
