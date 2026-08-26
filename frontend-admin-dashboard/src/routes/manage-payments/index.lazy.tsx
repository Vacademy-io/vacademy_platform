import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { SettingsQuickAccessButton } from '@/components/settings/quick-access/SettingsQuickAccessButton';
import { SettingsTabs } from '@/routes/settings/-constants/terms';
import { TransactionsView } from './-components/TransactionsView';

export const Route = createLazyFileRoute('/manage-payments/')({
    component: () => (
        <LayoutContainer className="lg:mt-3">
            <ManagePaymentsLayoutPage />
        </LayoutContainer>
    ),
});

function ManagePaymentsLayoutPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(
            <div className="flex items-center gap-2">
                <h1 className="text-lg">Manage Payments</h1>
                <SettingsQuickAccessButton
                    settingsKey={SettingsTabs.PaymentGateways}
                    label="Payment settings"
                />
            </div>
        );
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Manage Payments</title>
                <meta name="description" content="Manage payments and billing for your institute" />
            </Helmet>

            <div className="space-y-4 px-6 pb-6 pt-2">
                <TransactionsView />
            </div>
        </>
    );
}
