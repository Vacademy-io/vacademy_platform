import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { AdmissionStudentsTable } from '@/routes/erp/admissions/-components/AdmissionStudentsTable';
import { useBatchBuckets } from '@/routes/erp/admissions/-components/useBatchBuckets';

export const Route = createLazyFileRoute('/erp/admissions/')({
    component: () => (
        <LayoutContainer>
            <EnrolledStudentsPage />
        </LayoutContainer>
    ),
});

function EnrolledStudentsPage() {
    const { t } = useTranslation('erpAdmissions');
    const { setNavHeading } = useNavHeadingStore();
    const { enrolledIds } = useBatchBuckets();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">{t('enrolled.title')}</h1>);
    }, [setNavHeading, t]);

    return (
        <>
            <Helmet>
                <title>{t('enrolled.title')}</title>
                <meta name="description" content={t('enrolled.description')} />
            </Helmet>
            <div className="flex flex-col gap-4 p-8">
                <p className="text-body text-neutral-500">{t('enrolled.description')}</p>
                <AdmissionStudentsTable
                    packageSessionIds={enrolledIds}
                    emptyTitle={t('enrolled.emptyTitle')}
                    emptyDescription={t('enrolled.emptyDescription')}
                />
            </div>
        </>
    );
}
