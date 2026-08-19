import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { MentorSessionsPanel } from '../-components/MentorSessionsPanel';
import { MentorshipTabs } from '../-components/MentorshipTabs';

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
                <div className="flex flex-col">
                    <h2 className="text-title font-semibold text-neutral-700">Sessions</h2>
                    <p className="text-body text-neutral-500">
                        Every mentor session, what came of it, and how learners rated it.
                    </p>
                </div>
                <MentorshipTabs />
                <MentorSessionsPanel instituteId={getInstituteId()} />
            </div>
        </LayoutContainer>
    );
}
