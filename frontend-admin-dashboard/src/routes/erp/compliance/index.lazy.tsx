import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { FilingsHub } from '@/routes/erp/compliance/-components/FilingsHub';

export const Route = createLazyFileRoute('/erp/compliance/')({
    component: () => (
        <LayoutContainer>
            <CompliancePage />
        </LayoutContainer>
    ),
});

function CompliancePage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Statutory Filings</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Statutory Filings</title>
                <meta name="description" content="Preview and download the statutory filings built from your approved payroll runs." />
            </Helmet>
            <FilingsHub />
        </>
    );
}
