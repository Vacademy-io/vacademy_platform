import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { ScheduleTestMainComponent } from './-components/ScheduleTestMainComponent';

export const Route = createLazyFileRoute('/assessment/assessment-list/')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LayoutContainer>
      <ScheduleTestMainComponent />
    </LayoutContainer>
  );
}
