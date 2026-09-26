import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet';
import { PayInstallmentsMain } from './-components/PayInstallmentsMain';

export const Route = createLazyFileRoute('/financial-management/pay-installments/')({
    component: () => (
        <LayoutContainer>
            <PayInstallmentsPage />
        </LayoutContainer>
    ),
});

function PayInstallmentsPage() {
    const { t } = useTranslation('financialManagementPayInstallmentsIndex');
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">{t('pageTitle')}</h1>);
    }, [setNavHeading, t]);

    return (
        <>
            <Helmet>
                <title>{t('pageTitle')}</title>
            </Helmet>
            <div className="flex flex-col gap-6 p-6 animate-in fade-in duration-300 w-full max-w-[1400px] mx-auto flex-1 min-h-0 h-full">
                <PayInstallmentsMain />
            </div>
        </>
    );
}
