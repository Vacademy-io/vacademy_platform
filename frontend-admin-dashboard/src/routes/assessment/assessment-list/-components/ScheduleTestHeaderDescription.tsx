import { useIsMobile } from '@/hooks/use-mobile';
import { MyButton } from '@/components/design-system/button';
import { CalendarBlank } from 'phosphor-react';
import { useNavigate } from '@tanstack/react-router';
import useIntroJsTour from '@/hooks/use-intro';
import { IntroKey } from '@/constants/storage/introKey';
import { createAssesmentButtonStep } from '@/constants/intro/steps';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Examination, Mock, Practice, Survey } from '@/svgs';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { cn } from '@/lib/utils';

export const ScheduleTestHeaderDescription = () => {
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const { getCourseFromPackage } = useInstituteDetailsStore();

    const handleRedirectRoute = (type: string) => {
        navigate({
            to: '/assessment/create-assessment/$assessmentId/$examtype',
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
        steps: createAssesmentButtonStep,
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
                    Effortlessly monitor and manage all assessments with a comprehensive view of
                    ongoing, upcoming, and past exams. Gain easy access to each test&rsquo;s
                    details, schedule, and status, ensuring organized oversight of the entire
                    testing process from start to finish.
                </p>
            </div>
            <Dialog>
                <DialogTrigger
                    disabled={getCourseFromPackage().length === 0}
                    className={cn(
                        getCourseFromPackage().length === 0 && 'pointer-events-none opacity-55'
                    )}
                >
                    <MyButton
                        scale="large"
                        buttonType="primary"
                        layoutVariant="default"
                        id="create-assessment"
                    >
                        <CalendarBlank size={32} />
                        Create Assessment
                    </MyButton>
                </DialogTrigger>
                <DialogContent className="no-scrollbar !m-0 flex h-screen !w-4/5 flex-col gap-8 overflow-y-auto !p-0">
                    <h1 className="rounded-lg bg-primary-50 p-4 font-semibold text-primary-500">
                        Create Assessment
                    </h1>
                    <div className="mb-4 flex size-auto flex-col items-center justify-center gap-11">
                        <div className="flex items-center gap-12">
                            <div
                                onClick={() => handleRedirectRoute('EXAM')}
                                className="flex size-[300px] cursor-pointer flex-col items-center rounded-xl border bg-neutral-50 p-8"
                            >
                                <Examination />
                                <h1 className="text-[1.4rem] font-semibold">Examination</h1>
                                <p className="text-center text-sm text-neutral-500">
                                    A Fixed-time assessment that goes live for a specific schedule,
                                    simulating real exam conditions.
                                </p>
                            </div>
                            <div
                                onClick={() => handleRedirectRoute('MOCK')}
                                className="flex size-[300px] cursor-pointer flex-col items-center rounded-xl border bg-neutral-50 p-8"
                            >
                                <Mock />
                                <h1 className="text-[1.4rem] font-semibold">Mock Assessment</h1>
                                <p className="text-center text-sm text-neutral-500">
                                    A practice assessment always available, with a fixed duration to
                                    replicate exam scenarios.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-12">
                            <div
                                onClick={() => handleRedirectRoute('PRACTICE')}
                                className="flex size-[300px] cursor-pointer flex-col items-center rounded-xl border bg-neutral-50 p-8"
                            >
                                <Practice />
                                <h1 className="text-[1.4rem] font-semibold">Practice Assessment</h1>
                                <p className="text-center text-sm text-neutral-500">
                                    An on-demand assessment with no time limits, allowing students
                                    to attempt it anytime.
                                </p>
                            </div>
                            <div
                                onClick={() => handleRedirectRoute('SURVEY')}
                                className="flex size-[300px] cursor-pointer flex-col items-center rounded-xl border bg-neutral-50 p-8"
                            >
                                <Survey />
                                <h1 className="text-[1.4rem] font-semibold">Survey</h1>
                                <p className="text-center text-sm text-neutral-500">
                                    A set of questions for feedback or opinions, with no right or
                                    wrong answers.
                                </p>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
