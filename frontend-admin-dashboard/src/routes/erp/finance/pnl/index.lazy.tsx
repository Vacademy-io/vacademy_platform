import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { PnlMain } from '../-components/PnlMain';

export const Route = createLazyFileRoute('/erp/finance/pnl/')({
    component: () => (
        <LayoutContainer>
            <PnlPage />
        </LayoutContainer>
    ),
});

function PnlPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">P&amp;L Snapshot</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>P&amp;L Snapshot</title>
                <meta
                    name="description"
                    content="Collected fee revenue against payroll cost for the month, broken down by department."
                />
            </Helmet>
            <PnlMain />
        </>
    );
}
