import { useIsMobile } from '@/hooks/use-mobile';
import { MyButton } from '@/components/design-system/button';
import { CalendarBlank } from 'phosphor-react';
import { useNavigate } from '@tanstack/react-router';
import useIntroJsTour from '@/hooks/use-intro';
import { IntroKey } from '@/constants/storage/introKey';
import { createAssesmentSteps } from '@/constants/intro/steps';

export const ScheduleTestHeaderDescription = () => {
    const isMobile = useIsMobile();
    const navigate = useNavigate();

    const handleRedirectRoute = (type: string) => {
        navigate({
            to: '/homework-creation/create-assessment/$assessmentId/$examtype',
            params: {
                assessmentId: 'defaultId',
                examtype: type,
            },
            search: {
                currentStep: 0,
            },
        });
    };

    useIntroJsTour({
        key: IntroKey.assessmentFirstTimeVisit,
        steps: createAssesmentSteps.filter((step) => step.element === '#create-assessment'),
        partial: true,
        onTourExit: () => {
            console.log('Tour Completed');
        },
    });

    return (
        <div
            className={`mb-8 flex items-center justify-between ${
                isMobile ? 'flex-wrap gap-4' : 'gap-10'
            }`}
        >
            <div className="flex flex-col">
                <h1 className="text-[1.25rem] font-semibold text-neutral-600">
                    Comprehensive Test Management
                </h1>
                <p className="text-neutral-600">
                    Effortlessly monitor and manage all homeworks with a comprehensive view of
                    ongoing, upcoming, and past exams. Gain easy access to each test&rsquo;s
                    details, schedule, and status, ensuring organized oversight of the entire
                    testing process from start to finish.
                </p>
            </div>
            <MyButton
                scale="large"
                buttonType="primary"
                layoutVariant="default"
                id="create-assessment"
                onClick={() => handleRedirectRoute('EXAM')}
            >
                <CalendarBlank size={32} />
                Create Homework
            </MyButton>
        </div>
    );
};
