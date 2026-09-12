import { Helmet } from 'react-helmet';
import { QuestionPapersHeading } from './QuestionPapersHeading';
import { QuestionPapersTabs } from './QuestionPapersTabs';
import { useEffect, useState } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useTranslation } from 'react-i18next';

export function QuestionPapersComponent() {
    const { t } = useTranslation('assessmentQuestionPapersComponent');
    const { setNavHeading } = useNavHeadingStore();
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">{t('heading')}</h1>);
    }, []);

    return (
        <>
            <Helmet>
                <title>{t('pageTitle')}</title>
                <meta name="description" content={t('pageDescription')} />
            </Helmet>
            <div className="flex flex-col gap-4">
                <QuestionPapersHeading
                    currentQuestionIndex={currentQuestionIndex}
                    setCurrentQuestionIndex={setCurrentQuestionIndex}
                />
                <QuestionPapersTabs
                    isAssessment={false}
                    currentQuestionIndex={currentQuestionIndex}
                    setCurrentQuestionIndex={setCurrentQuestionIndex}
                />
            </div>
        </>
    );
}
