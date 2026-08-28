import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { ChallansMain } from '@/routes/erp/compliance/-components/ChallansMain';

export const Route = createLazyFileRoute('/erp/compliance/challans/')({
    component: () => (
        <LayoutContainer>
            <CompliancePage />
        </LayoutContainer>
    ),
});

function CompliancePage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">TDS Challans</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>TDS Challans</title>
                <meta name="description" content="Record TDS deposits so Form 24Q can reconcile each quarter." />
            </Helmet>
            <ChallansMain />
        </>
    );
}
