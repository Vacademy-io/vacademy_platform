import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useEffect } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { InternalSidebar } from './-components/InternalSidebar';
import { QuestionDisplay } from './-components/QuestionDisplay';

export const Route = createLazyFileRoute('/community/question-paper/')({
  component: QuestionPaperLayout,
});

function QuestionPaperLayout() {
  const { id } = Route.useSearch();

  const { setNavHeading } = useNavHeadingStore();
  useEffect(() => {
    setNavHeading(<h1 className="text-lg">Community</h1>);
  }, []);

  return (
    <LayoutContainer intrnalMargin={false} className="flex-1">
      <div className="flex h-full flex-1 flex-row">
        <InternalSidebar id={id} />
        <QuestionDisplay id={id} />
      </div>
    </LayoutContainer>
  );
}
