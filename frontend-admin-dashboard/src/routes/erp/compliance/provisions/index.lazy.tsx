import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { ProvisionsMain } from '@/routes/erp/compliance/-components/ProvisionsMain';

export const Route = createLazyFileRoute('/erp/compliance/provisions/')({
    component: () => (
        <LayoutContainer>
            <CompliancePage />
        </LayoutContainer>
    ),
});

function CompliancePage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Provisions</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Provisions</title>
                <meta name="description" content="Gratuity, end-of-service and statutory bonus provisions." />
            </Helmet>
            <ProvisionsMain />
        </>
    );
}
