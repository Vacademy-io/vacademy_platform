import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { Examination, Mock, Practice, Survey } from '@/svgs';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Helmet } from 'react-helmet';

// Route stub for TanStack Router - actual component loaded via index.lazy.tsx
export const Route = createFileRoute('/assessment/')({});

function AssessmentPage() {
    const { setNavHeading } = useNavHeadingStore();
    const navigate = useNavigate();

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

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Assessments</h1>);
    }, []);
    return (
        <>
            <Helmet>
                <title>Assessments</title>
                <meta
                    name="description"
                    content="This page shows all types of assessments that you can create here."
                />
            </Helmet>
            <div className="pb-4 text-lg font-semibold sm:pb-6 sm:text-title">
                Create Assessment
            </div>
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:gap-8">
                <div
                    onClick={() => handleRedirectRoute('EXAM')}
                    className="flex cursor-pointer flex-col items-center rounded-xl border bg-neutral-50 p-4 transition-all hover:border-primary-200 hover:shadow-md active:scale-[0.98] sm:p-6 md:p-8"
                >
                    <Examination className="size-16 sm:size-auto" />
                    <h1 className="mt-2 text-lg font-semibold sm:text-[1.4rem]">Examination</h1>
                    <p className="mt-1 text-center text-xs text-neutral-500 sm:text-sm">
                        A Fixed-time assessment that goes live for a specific schedule, simulating
                        real exam conditions.
                    </p>
                </div>
                <div
                    onClick={() => handleRedirectRoute('MOCK')}
                    className="flex cursor-pointer flex-col items-center rounded-xl border bg-neutral-50 p-4 transition-all hover:border-primary-200 hover:shadow-md active:scale-[0.98] sm:p-6 md:p-8"
                >
                    <Mock className="size-16 sm:size-auto" />
                    <h1 className="mt-2 text-lg font-semibold sm:text-[1.4rem]">Mock Assessment</h1>
                    <p className="mt-1 text-center text-xs text-neutral-500 sm:text-sm">
                        A practice assessment always available, with a fixed duration to replicate
                        exam scenarios.
                    </p>
                </div>
                <div
                    onClick={() => handleRedirectRoute('PRACTICE')}
                    className="flex cursor-pointer flex-col items-center rounded-xl border bg-neutral-50 p-4 transition-all hover:border-primary-200 hover:shadow-md active:scale-[0.98] sm:p-6 md:p-8"
                >
                    <Practice className="size-16 sm:size-auto" />
                    <h1 className="mt-2 text-lg font-semibold sm:text-[1.4rem]">
                        Practice Assessment
                    </h1>
                    <p className="mt-1 text-center text-xs text-neutral-500 sm:text-sm">
                        An on-demand assessment with no time limits, allowing students to attempt it
                        anytime.
                    </p>
                </div>
                <div
                    onClick={() => handleRedirectRoute('SURVEY')}
                    className="flex cursor-pointer flex-col items-center rounded-xl border bg-neutral-50 p-4 transition-all hover:border-primary-200 hover:shadow-md active:scale-[0.98] sm:p-6 md:p-8"
                >
                    <Survey className="size-16 sm:size-auto" />
                    <h1 className="mt-2 text-lg font-semibold sm:text-[1.4rem]">Survey</h1>
                    <p className="mt-1 text-center text-xs text-neutral-500 sm:text-sm">
                        A set of questions for feedback or opinions, with no right or wrong answers.
                    </p>
                </div>
            </div>
        </>
    );
}

export default function AssessmentRouteComponent() {
    return (
        <LayoutContainer>
            <AssessmentPage />
        </LayoutContainer>
    );
}
