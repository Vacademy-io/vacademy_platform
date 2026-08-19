import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { MentorshipDashboard } from '../-components/MentorshipDashboard';
import { MentorshipPageHeader } from '../-components/MentorshipPageHeader';

export const Route = createLazyFileRoute('/mentorship/dashboard/')({
    component: MentorshipDashboardRoute,
});

function MentorshipDashboardRoute() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Mentorship</h1>);
    }, [setNavHeading]);

    return (
        <LayoutContainer>
            <div className="flex flex-col gap-6 p-6">
                <MentorshipPageHeader
                    title="Mentorship Overview"
                    subtitle="Complete insights into your mentorship program"
                />
                <MentorshipDashboard instituteId={getInstituteId()} />
            </div>
        </LayoutContainer>
    );
}
