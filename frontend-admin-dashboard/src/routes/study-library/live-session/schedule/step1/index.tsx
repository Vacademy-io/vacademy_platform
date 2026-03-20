import { createFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { useEffect } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { CaretLeft } from '@phosphor-icons/react';
import ScheduleStep1 from '../-components/scheduleStep1';
import { useNavigate } from '@tanstack/react-router';
import { useLiveSessionStore } from '../-store/sessionIdstore';
export const Route = createFileRoute('/study-library/live-session/schedule/step1/')({
    component: RouteComponent,
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();
    const { clearSessionId, clearStep1Data, isEdit } = useLiveSessionStore();
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
        setNavHeading(heading);
        // Only clear data if not in edit mode
        if (!isEdit) {
            clearSessionId();
            clearStep1Data();
        }
    }, [isEdit, setNavHeading, clearSessionId, clearStep1Data]);
    return (
        <LayoutContainer>
            <Helmet>
                <title>Schedule</title>
                <meta
                    name="description"
                    content="This page helpls you schedule the live session for the institute"
                />
            </Helmet>
            <ScheduleStep1 />
        </LayoutContainer>
    );
}
