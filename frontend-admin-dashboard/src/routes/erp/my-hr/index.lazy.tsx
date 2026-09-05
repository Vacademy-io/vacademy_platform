import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyHrOverviewMain } from '@/routes/erp/my-hr/-components/MyHrOverviewMain';

export const Route = createLazyFileRoute('/erp/my-hr/')({
    component: () => (
        <LayoutContainer>
            <MyHrOverviewPage />
        </LayoutContainer>
    ),
});

function MyHrOverviewPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">My HR</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>My HR</title>
                <meta
                    name="description"
                    content="Your employee profile, today's attendance, leave balance and latest payslip."
                />
            </Helmet>
            <MyHrOverviewMain />
        </>
    );
}
