import { createLazyFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MyButton } from '@/components/design-system/button';
import { ArrowSquareOut, Plus } from '@phosphor-icons/react';
import { CreateAssessmentDashboardLogo, EvaluatorAI } from '@/svgs';
import { CollegeStudentsDashboardLogo } from '@/svgs';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from './-components/layout-container/layout-container';
import useLocalStorage from './-hooks/useLocalStorage';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export const Route = createLazyFileRoute('/evaluator-ai/')({
  component: () => (
    <LayoutContainer>
      <EvaluationDashboard />
    </LayoutContainer>
  ),
});

export function EvaluationDashboard() {
  const { t } = useTranslation('evaluatorAiIndex');
  const [assessments] = useLocalStorage('assessments', []);
  const [students] = useLocalStorage('students', []);

  const navigate = useNavigate();
  const { setNavHeading } = useNavHeadingStore();

  const router = useRouter();

  const handleEnrollButtonClick = () => {
    router.navigate({
      to: `/evaluator-ai/students`,
      search: {
        q: 'enroll',
      },
    });
  };

  useEffect(() => {
    setNavHeading(<h1 className="text-lg">{t('dashboardHeading')}</h1>);
  }, [t]);

  return (
    <>
      <Helmet>
        <title>{t('dashboardHeading')}</title>
        <meta
          name="description"
          content={t('dashboardDescription')}
        />
      </Helmet>
      <h1 className="text-2xl">
        {t('greetingHello')} <span className="text-primary-500">{t('greetingName')}</span>
      </h1>
      <div className="mt-8 flex w-full flex-col gap-6">
        <div className={`flex gap-6`}>
          <div className={`flex flex-1 gap-6`}>
            <Card className="flex-1 grow bg-neutral-50 shadow-none">
              <CardHeader className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <CardTitle>{t('enrollStudentsTitle')}</CardTitle>
                  <MyButton
                    type="submit"
                    scale="medium"
                    buttonType="secondary"
                    id="quick-enrollment"
                    layoutVariant="default"
                    className="text-sm"
                    onClick={handleEnrollButtonClick}
                  >
                    {t('enroll')}
                  </MyButton>
                </div>
                <CardDescription className="flex items-center gap-4">
                  <div
                    className="flex cursor-pointer items-center gap-1"
                    onClick={() =>
                      navigate({
                        to: '/evaluator-ai/students',
                      })
                    }
                  >
                    <div className="flex items-center gap-1">
                      <span>{getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner)}</span>
                      <ArrowSquareOut />
                    </div>
                    <span className="text-primary-500">
                      {students?.length ?? 0}
                    </span>
                  </div>
                </CardDescription>
                <CardDescription className="mt-2 flex items-center justify-center">
                  <CollegeStudentsDashboardLogo className="mt-4 size-60" />
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
          <div className="flex flex-1 flex-row gap-6">
            <Card className="flex-1 grow bg-neutral-50 shadow-none">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('createAssessmentTitle')}</CardTitle>
                  <MyButton
                    type="submit"
                    scale="medium"
                    id="first-assessment"
                    buttonType="secondary"
                    layoutVariant="default"
                    className="text-sm"
                    onClick={() => {
                      navigate({
                        to: '/evaluator-ai/assessment/create-assessment',
                      });
                    }}
                  >
                    <Plus size={32} />
                    {t('create')}
                  </MyButton>
                </div>
                <CardDescription className="flex items-center gap-4 py-6">
                  <div
                    className="flex cursor-pointer items-center gap-1"
                    onClick={() =>
                      navigate({
                        to: '/evaluator-ai/assessment',
                        search: { selectedTab: 'liveTests' },
                      })
                    }
                  >
                    <div className="flex items-center gap-1 hover:text-primary-500">
                      <span>{t('assessmentCreatedLabel')}</span>
                      <ArrowSquareOut />
                    </div>
                    <span className="text-primary-500">
                      {assessments?.length ?? 0}
                    </span>
                  </div>
                </CardDescription>
                <CardDescription className="mt-2 flex items-center justify-center">
                  <CreateAssessmentDashboardLogo className="mt-4" />
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
        <Card className="h-[400px] bg-neutral-50 shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('evaluateStudentsTitle')}</CardTitle>
              <MyButton
                type="submit"
                scale="medium"
                id="first-assessment"
                buttonType="secondary"
                layoutVariant="default"
                className="text-sm"
                onClick={() => {
                  navigate({
                    to: '/evaluator-ai/evaluation',
                    search: {
                      q: 'evalute',
                    },
                  });
                }}
              >
                {t('evaluate')}
              </MyButton>
            </div>
            <CardDescription className="flex items-center gap-4"></CardDescription>
            <CardDescription className="flex items-center justify-center">
              <EvaluatorAI className="mt-4" width={200} />
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}
