/* eslint-disable prettier/prettier */
import { createFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { useEffect } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { CaretLeft } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveSessionStore } from './-store/sessionIdstore';

export const Route = createFileRoute('/study-library/live-session/schedule/')({
    component: RouteComponent,
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();
    const { clearSessionId, clearStep1Data } = useLiveSessionStore();
    const navigate = useNavigate();

    const heading = (
        <div className="flex items-center gap-4">
            <CaretLeft
                onClick={() => navigate({ to: '/study-library/live-session' })}
                className="cursor-pointer"
            />
            <div>Schedule Live Sessions</div>
        </div>
    );

    useEffect(() => {
        clearSessionId();
        clearStep1Data();
        navigate({ to: '/study-library/live-session/schedule/step1' });
    }, []);

    useEffect(() => {
        setNavHeading(heading);
    }, []);
    return (
        <LayoutContainer>
            <Helmet>
                <title>Schedule</title>
                <meta
                    name="description"
                    content="This page helpls you schedule the live session for the institute"
                />
            </Helmet>
        </LayoutContainer>
    );
}
