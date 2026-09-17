import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '../-components/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StudentEnrollment } from './-components/add-student';

export const Route = createLazyFileRoute('/evaluator-ai/students/')({
    component: () => (
        <LayoutContainer>
            <RouteComponent />
        </LayoutContainer>
    ),
});

function RouteComponent() {
    const { t } = useTranslation('evaluatorAiStudentsIndex');
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">{t('learnerListHeading')}</h1>);
    }, [t]);
    return (
        <main className="flex min-h-screen scroll-mt-10 flex-col">
            <StudentEnrollment />
        </main>
    );
}
