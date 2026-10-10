import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { AdmissionStudentsTable } from '@/routes/erp/admissions/-components/AdmissionStudentsTable';
import { useBatchBuckets } from '@/routes/erp/admissions/-components/useBatchBuckets';

export const Route = createLazyFileRoute('/erp/admissions/flexi/')({
    component: () => (
        <LayoutContainer>
            <FlexiStudentsPage />
        </LayoutContainer>
    ),
});

function FlexiStudentsPage() {
    const { t } = useTranslation('erpAdmissions');
    const { setNavHeading } = useNavHeadingStore();
    const { flexiIds } = useBatchBuckets();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">{t('flexi.title')}</h1>);
    }, [setNavHeading, t]);

    return (
        <>
            <Helmet>
                <title>{t('flexi.title')}</title>
                <meta name="description" content={t('flexi.description')} />
            </Helmet>
            <div className="flex flex-col gap-4 p-8">
                <p className="text-body text-neutral-500">{t('flexi.description')}</p>
                <AdmissionStudentsTable
                    packageSessionIds={flexiIds}
                    emptyTitle={t('flexi.emptyTitle')}
                    emptyDescription={t('flexi.emptyDescription')}
                />
            </div>
        </>
    );
}
