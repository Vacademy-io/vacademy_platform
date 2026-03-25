import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import HeaderTabs from './-components/headerTabs';

export const Route = createLazyFileRoute('/study-library/reports/')({
    component: RouteComponent,
});

const heading = (
    <div className="flex items-center gap-4">
        <div>Reports</div>
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
                <title>Reports</title>
                <meta
                    name="description"
                    content="This page shows the study library of the institute."
                />
            </Helmet>
            <HeaderTabs />
        </LayoutContainer>
    );
}
