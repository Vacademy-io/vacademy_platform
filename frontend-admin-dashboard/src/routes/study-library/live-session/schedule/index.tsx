/* eslint-disable prettier/prettier */
import { createFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { useEffect } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { CaretLeft } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveSessionStore } from './-store/sessionIdstore';
import { useLiveSessionSettings } from '@/hooks/useLiveSessionSettings';

export const Route = createFileRoute('/study-library/live-session/schedule/')({
    component: RouteComponent,
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();
    const { clearSessionId, clearStep1Data } = useLiveSessionStore();
    const navigate = useNavigate();
    const { settings, isLoading } = useLiveSessionSettings();

    const heading = (
        <div className="flex items-center gap-4">
            <CaretLeft
                onClick={() => navigate({ to: '/study-library/live-session' })}
                className="cursor-pointer"
            />
            <div>Schedule Live Sessions</div>
        </div>
    );

    // Pick the right schedule entry point based on what's actually enabled.
    // If single is on → /schedule/step1 (default). If single is off but bulk
    // is on → /schedule/bulk. If both are off → bounce back to the list.
    useEffect(() => {
        if (isLoading) return;
        clearSessionId();
        clearStep1Data();
        if (settings.singleScheduleEnabled) {
            navigate({ to: '/study-library/live-session/schedule/step1' });
        } else if (settings.bulkScheduleEnabled) {
            navigate({ to: '/study-library/live-session/schedule/bulk' });
        } else {
            navigate({ to: '/study-library/live-session' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, settings.singleScheduleEnabled, settings.bulkScheduleEnabled]);

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
