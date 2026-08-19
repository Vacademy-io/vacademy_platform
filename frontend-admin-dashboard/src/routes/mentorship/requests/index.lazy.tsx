import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { MentorRequestsPanel } from '../-components/MentorRequestsPanel';

export const Route = createLazyFileRoute('/mentorship/requests/')({
    component: MentorRequestsRoute,
});

function MentorRequestsRoute() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Mentorship</h1>);
    }, [setNavHeading]);

    return (
        <LayoutContainer>
            <MentorRequestsPanel instituteId={getInstituteId()} />
        </LayoutContainer>
    );
}
