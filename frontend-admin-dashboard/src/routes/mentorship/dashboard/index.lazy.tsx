import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { MentorshipDashboard } from '../-components/MentorshipDashboard';

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
                <div className="flex flex-col">
                    <h2 className="text-title font-semibold text-neutral-700">Mentorship</h2>
                    <p className="text-body text-neutral-500">
                        How mentoring is going across your institute.
                    </p>
                </div>
                <MentorshipDashboard instituteId={getInstituteId()} />
            </div>
        </LayoutContainer>
    );
}
