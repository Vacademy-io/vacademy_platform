import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { ScheduleTestMainComponent } from './-components/ScheduleTestMainComponent';

export const Route = createLazyFileRoute('/homework-creation/assessment-list/')({
    component: () => (
        <LayoutContainer>
            <ScheduleTestMainComponent />
        </LayoutContainer>
    ),
});
