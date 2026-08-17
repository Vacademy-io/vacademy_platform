import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { PaymentDashboard } from '@/routes/manage-payments/-components/PaymentDashboard';

export const Route = createLazyFileRoute('/payment-dashboard/')({
    component: () => (
        <LayoutContainer>
            <PaymentDashboardPage />
        </LayoutContainer>
    ),
});

function PaymentDashboardPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Payment Dashboard</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Payment Dashboard</title>
                <meta
                    name="description"
                    content="Collections and outstanding analytics for your institute"
                />
            </Helmet>

            <div className="p-6">
                <PaymentDashboard />
            </div>
        </>
    );
}
