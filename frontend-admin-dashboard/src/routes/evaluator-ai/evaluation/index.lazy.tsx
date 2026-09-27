import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '../-components/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EvaluatedStudents } from './-components/evaluation';

export const Route = createLazyFileRoute('/evaluator-ai/evaluation/')({
  component: () => (
    <LayoutContainer>
      <RouteComponent />
    </LayoutContainer>
  ),
});

function RouteComponent() {
  const { t } = useTranslation('evaluatorAiEvaluationIndex');
  const { setNavHeading } = useNavHeadingStore();
  useEffect(() => {
    setNavHeading(<h1 className="text-lg">{t('evaluateStudentsHeading')}</h1>);
  }, [t]);
  return <EvaluatedStudents />;
}
