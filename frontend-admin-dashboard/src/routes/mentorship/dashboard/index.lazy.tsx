import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { MentorshipDashboard } from '../-components/MentorshipDashboard';
import { MentorshipPageHeader } from '../-components/MentorshipPageHeader';

export const Route = createLazyFileRoute('/mentorship/dashboard/')({
    component: MentorshipDashboardRoute,
});

function MentorshipDashboardRoute() {
    const { t } = useTranslation('mentorshipDashboardIndex');
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">{t('navHeading')}</h1>);
    }, [setNavHeading, t]);

    return (
        <LayoutContainer>
            <div className="flex flex-col gap-6 p-6">
                <MentorshipPageHeader title={t('title')} subtitle={t('subtitle')} />
                <MentorshipDashboard instituteId={getInstituteId()} />
            </div>
        </LayoutContainer>
    );
}
