import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { MentorSessionsPanel } from '../-components/MentorSessionsPanel';
import { MentorshipPageHeader } from '../-components/MentorshipPageHeader';

export const Route = createLazyFileRoute('/mentorship/sessions/')({
    component: MentorSessionsRoute,
});

function MentorSessionsRoute() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Mentorship</h1>);
    }, [setNavHeading]);

    return (
        <LayoutContainer>
            <div className="flex flex-col gap-6 p-6">
                <MentorshipPageHeader
                    title="Sessions"
                    subtitle="Track and manage all mentorship sessions"
                />
                <MentorSessionsPanel instituteId={getInstituteId()} />
            </div>
        </LayoutContainer>
    );
}
