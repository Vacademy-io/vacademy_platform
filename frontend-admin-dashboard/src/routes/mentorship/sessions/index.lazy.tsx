import { useEffect, useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { CalendarPlus } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { MyButton } from '@/components/design-system/button';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { MentorSessionsPanel } from '../-components/MentorSessionsPanel';
import { MentorshipPageHeader } from '../-components/MentorshipPageHeader';
import { ScheduleSessionDialog } from '../-components/ScheduleSessionDialog';

export const Route = createLazyFileRoute('/mentorship/sessions/')({
    component: MentorSessionsRoute,
});

function MentorSessionsRoute() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Mentorship</h1>);
    }, [setNavHeading]);

    const instituteId = getInstituteId();
    const [scheduleOpen, setScheduleOpen] = useState(false);

    return (
        <LayoutContainer>
            <div className="flex flex-col gap-6 p-6">
                <MentorshipPageHeader
                    title="Sessions"
                    subtitle="Track and manage all mentorship sessions"
                >
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        onClick={() => setScheduleOpen(true)}
                        title="Book a 1:1 between a mentor and a student"
                    >
                        <CalendarPlus size={18} /> Schedule 1:1
                    </MyButton>
                </MentorshipPageHeader>
                <MentorSessionsPanel instituteId={instituteId} />

                <ScheduleSessionDialog
                    instituteId={instituteId}
                    open={scheduleOpen}
                    onOpenChange={setScheduleOpen}
                />
            </div>
        </LayoutContainer>
    );
}
