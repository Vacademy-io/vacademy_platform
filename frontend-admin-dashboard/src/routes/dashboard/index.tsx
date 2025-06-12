import { createFileRoute, useLocation, useNavigate, useRouter } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MyButton } from '@/components/design-system/button';
import { ArrowSquareOut, Plus } from 'phosphor-react';
import { CreateAssessmentDashboardLogo, DashboardCreateCourse } from '@/svgs';
import { Badge } from '@/components/ui/badge';
import { CompletionStatusComponent } from './-components/CompletionStatusComponent';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { IntroKey } from '@/constants/storage/introKey';
import useIntroJsTour from '@/hooks/use-intro';
import { dashboardSteps } from '@/constants/intro/steps';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import {
    getAssessmentsCountsData,
    getInstituteDashboardData,
} from './-services/dashboard-services';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { SSDC_INSTITUTE_ID } from '@/constants/urls';
import { Helmet } from 'react-helmet';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { getModuleFlags } from '@/components/common/layout-container/sidebar/helper';
import RoleTypeComponent from './-components/RoleTypeComponent';
import useLocalStorage from '@/hooks/use-local-storage';
import EditDashboardProfileComponent from './-components/EditDashboardProfileComponent';

export const Route = createFileRoute('/dashboard/')({
    component: () => (
        <LayoutContainer>
            <DashboardComponent />
        </LayoutContainer>
    ),
});

export function DashboardComponent() {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const location = useLocation();
    const { getValue, setValue } = useLocalStorage<boolean>(IntroKey.dashboardWelcomeVideo, true);
    const { data: instituteDetails, isLoading: isInstituteLoading } =
        useSuspenseQuery(useInstituteQuery());
    const subModules = getModuleFlags(instituteDetails?.sub_modules);

    const { data, isLoading: isDashboardLoading } = useSuspenseQuery(
        getInstituteDashboardData(instituteDetails?.id)
    );

    const { data: assessmentCount, isLoading: isAssessmentCountLoading } = useSuspenseQuery(
        getAssessmentsCountsData(instituteDetails?.id)
    );
    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();
    const [roleTypeCount, setRoleTypeCount] = useState({
        ADMIN: 0,
        'COURSE CREATOR': 0,
        'ASSESSMENT CREATOR': 0,
        EVALUATOR: 0,
        TEACHER: 0,
    });

    useIntroJsTour({
        key: IntroKey.dashboardFirstTimeVisit,
        steps: dashboardSteps,
        onTourExit: () => {
            console.log('Tour Completed');
        },
    });

    const handleAssessmentTypeRoute = (type: string) => {
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

    const router = useRouter();

    const handleEnrollButtonClick = () => {
        router.navigate({
            to: `/manage-students/students-list`,
        });
    };

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Dashboard</h1>);
    }, []);

    useEffect(() => {
        if (location.pathname !== '/dashboard') {
            setValue(false);
        }
    }, [location.pathname, setValue]);

    if (isInstituteLoading || isDashboardLoading || isAssessmentCountLoading)
        return <DashboardLoader />;
    return (
        <>
            <Helmet>
                <title>Dashboard</title>
                <meta
                    name="description"
                    content="This page shows the dashboard of the institute."
                />
            </Helmet>
            <h1 className="text-base">
                Hello <span className="text-primary-500">{tokenData?.fullname}!</span>
            </h1>
            {getValue() && (
                <>
                    <p className="mt-1 text-sm">
                        Welcome aboard! We&apos;re excited to have you here. Let&apos;s set up your
                        admin dashboard and make learning seamless and engaging.
                    </p>
                    {instituteDetails?.id !== SSDC_INSTITUTE_ID && (
                        <iframe
                            className="m-auto mt-6 h-[70vh] w-[70%] rounded-xl"
                            src="https://www.youtube.com/embed/s2z1xbCWwRE?si=cgJvdMCJ8xg32lZ7"
                            title="YouTube video player"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        />
                    )}
                </>
            )}
            <div className="mt-8 flex w-full flex-col gap-6">
                <Card className="grow bg-neutral-50 shadow-none">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Complete your institute profile</CardTitle>
                            <EditDashboardProfileComponent isEdit={false} />
                        </div>
                        <CardDescription className="flex items-center gap-2">
                            <CompletionStatusComponent
                                profileCompletionPercentage={data.profile_completion_percentage}
                            />
                            <span>{data.profile_completion_percentage}% complete</span>
                        </CardDescription>
                    </CardHeader>
                </Card>
                <div className={`flex ${subModules.assess ? 'flex-col' : 'flex-row'} gap-6`}>
                    <div
                        className={`flex flex-1 ${
                            subModules.assess ? 'flex-row' : 'flex-col'
                        } gap-6`}
                    >
                        <Card className="flex-1 bg-neutral-50 shadow-none">
                            <CardHeader className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle>Role Type Users</CardTitle>
                                    <RoleTypeComponent setRoleTypeCount={setRoleTypeCount} />
                                </div>
                                <div className="flex flex-col items-start gap-3">
                                    <div className="flex items-center gap-3">
                                        <Badge className="whitespace-nowrap rounded-lg border border-neutral-300 bg-[#F4F9FF] py-1.5 font-thin shadow-none">
                                            Admin
                                        </Badge>
                                        <span className="font-thin text-primary-500">
                                            {roleTypeCount.ADMIN}
                                        </span>
                                        <Badge className="whitespace-nowrap rounded-lg border border-neutral-300 bg-[#F4FFF9] py-1.5 font-thin shadow-none">
                                            Course Creator
                                        </Badge>
                                        <span className="font-thin text-primary-500">
                                            {roleTypeCount['COURSE CREATOR']}
                                        </span>
                                        <Badge className="whitespace-nowrap rounded-lg border border-neutral-300 bg-[#FFF4F5] py-1.5 font-thin shadow-none">
                                            Assessment Creator
                                        </Badge>
                                        <span className="font-thin text-primary-500">
                                            {roleTypeCount['ASSESSMENT CREATOR']}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge className="whitespace-nowrap rounded-lg border border-neutral-300 bg-[#FFF4F5] py-1.5 font-thin shadow-none">
                                            Teacher
                                        </Badge>
                                        <span className="font-thin text-primary-500">
                                            {roleTypeCount['TEACHER']}
                                        </span>
                                        <Badge className="whitespace-nowrap rounded-lg border border-neutral-300 bg-[#F5F0FF] py-1.5 font-thin shadow-none">
                                            Evaluator
                                        </Badge>
                                        <span className="font-thin text-primary-500">
                                            {roleTypeCount.EVALUATOR}
                                        </span>
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>
                        <Card className="flex-1 grow bg-neutral-50 shadow-none">
                            <CardHeader className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle>Enroll students in institute batches</CardTitle>
                                    <MyButton
                                        type="submit"
                                        scale="medium"
                                        buttonType="secondary"
                                        id="quick-enrollment"
                                        layoutVariant="default"
                                        className="text-sm"
                                        onClick={handleEnrollButtonClick}
                                    >
                                        Enroll
                                    </MyButton>
                                </div>
                                <CardDescription className="flex items-center gap-4">
                                    <div
                                        className="flex cursor-pointer items-center gap-1"
                                        onClick={() =>
                                            navigate({
                                                to: '/manage-institute/batches',
                                            })
                                        }
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Batches</span>
                                            <ArrowSquareOut />
                                        </div>
                                        <span className="text-primary-500">{data.batch_count}</span>
                                    </div>
                                    <div
                                        className="flex cursor-pointer items-center gap-1"
                                        onClick={() =>
                                            navigate({
                                                to: '/manage-students/students-list',
                                            })
                                        }
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Students</span>
                                            <ArrowSquareOut />
                                        </div>
                                        <span className="text-primary-500">
                                            {data.student_count}
                                        </span>
                                    </div>
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>
                    <div className="flex flex-1 flex-row gap-6">
                        <Card className="flex-1 bg-neutral-50 shadow-none">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Learning Center</CardTitle>
                                    <MyButton
                                        type="submit"
                                        scale="medium"
                                        id="first-course"
                                        buttonType="secondary"
                                        layoutVariant="default"
                                        className="text-sm"
                                    >
                                        <Plus size={32} />
                                        Create Course
                                    </MyButton>
                                    <MyButton
                                        type="submit"
                                        scale="medium"
                                        id="first-course"
                                        buttonType="secondary"
                                        layoutVariant="default"
                                        className="text-sm"
                                    >
                                        <Plus size={32} />
                                        Add Study Slides
                                    </MyButton>
                                </div>
                                <CardDescription className="flex items-center gap-4 py-6">
                                    <div className="flex cursor-pointer items-center gap-1">
                                        <div
                                            className="flex items-center gap-1"
                                            onClick={() =>
                                                navigate({
                                                    to: '/study-library/courses',
                                                })
                                            }
                                        >
                                            <span>Courses</span>
                                            <ArrowSquareOut />
                                        </div>
                                        <span className="text-primary-500">
                                            {data.course_count}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span>Level</span>
                                        <span className="text-primary-500">
                                            {instituteDetails?.levels?.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span>Subjects</span>
                                        <span className="text-primary-500">
                                            {instituteDetails?.subjects?.length}
                                        </span>
                                    </div>
                                </CardDescription>
                                <CardDescription className="flex justify-center">
                                    <DashboardCreateCourse />
                                </CardDescription>
                            </CardHeader>
                        </Card>
                        {subModules.assess && (
                            <Card className="flex-1 grow bg-neutral-50 shadow-none">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Assessment</CardTitle>
                                        <Dialog>
                                            <DialogTrigger>
                                                <MyButton
                                                    type="submit"
                                                    scale="medium"
                                                    id="first-assessment"
                                                    buttonType="secondary"
                                                    layoutVariant="default"
                                                    className="text-sm"
                                                >
                                                    <Plus size={32} />
                                                    Create
                                                </MyButton>
                                            </DialogTrigger>
                                            <DialogContent className="p-0">
                                                <h1 className="rounded-lg bg-primary-50 p-4 text-primary-500">
                                                    Create Assessment
                                                </h1>
                                                <div className="flex flex-col items-center justify-center gap-6">
                                                    <MyButton
                                                        type="button"
                                                        scale="large"
                                                        buttonType="secondary"
                                                        className="mt-2 font-medium"
                                                        onClick={() =>
                                                            handleAssessmentTypeRoute('EXAM')
                                                        }
                                                    >
                                                        Examination
                                                    </MyButton>
                                                    <MyButton
                                                        type="button"
                                                        scale="large"
                                                        buttonType="secondary"
                                                        className="font-medium"
                                                        onClick={() =>
                                                            handleAssessmentTypeRoute('MOCK')
                                                        }
                                                    >
                                                        Mock
                                                    </MyButton>
                                                    <MyButton
                                                        type="button"
                                                        scale="large"
                                                        buttonType="secondary"
                                                        className="font-medium"
                                                        onClick={() =>
                                                            handleAssessmentTypeRoute('PRACTICE')
                                                        }
                                                    >
                                                        Practice
                                                    </MyButton>
                                                    <MyButton
                                                        type="button"
                                                        scale="large"
                                                        buttonType="secondary"
                                                        className="mb-6 font-medium"
                                                        onClick={() =>
                                                            handleAssessmentTypeRoute('SURVEY')
                                                        }
                                                    >
                                                        Survey
                                                    </MyButton>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                    <CardDescription className="flex items-center gap-4 py-6">
                                        <div
                                            className="flex cursor-pointer items-center gap-1"
                                            onClick={() =>
                                                navigate({
                                                    to: '/assessment/assessment-list',
                                                    search: { selectedTab: 'liveTests' },
                                                })
                                            }
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Live</span>
                                                <ArrowSquareOut />
                                            </div>
                                            <span className="text-primary-500">
                                                {assessmentCount?.live_count}
                                            </span>
                                        </div>
                                        <div
                                            className="flex cursor-pointer items-center gap-1"
                                            onClick={() =>
                                                navigate({
                                                    to: '/assessment/assessment-list',
                                                    search: { selectedTab: 'upcomingTests' },
                                                })
                                            }
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Upcoming</span>
                                                <ArrowSquareOut />
                                            </div>
                                            <span className="text-primary-500">
                                                {assessmentCount?.upcoming_count}
                                            </span>
                                        </div>
                                        <div
                                            className="flex cursor-pointer items-center gap-1"
                                            onClick={() =>
                                                navigate({
                                                    to: '/assessment/assessment-list',
                                                    search: { selectedTab: 'previousTests' },
                                                })
                                            }
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Previous</span>
                                                <ArrowSquareOut />
                                            </div>
                                            <span className="text-primary-500">
                                                {assessmentCount?.previous_count}
                                            </span>
                                        </div>
                                        <div
                                            className="flex cursor-pointer items-center gap-1"
                                            onClick={() =>
                                                navigate({
                                                    to: '/assessment/assessment-list',
                                                    search: { selectedTab: 'draftTests' },
                                                })
                                            }
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Drafts</span>
                                                <ArrowSquareOut />
                                            </div>
                                            <span className="text-primary-500">
                                                {assessmentCount?.draft_count}
                                            </span>
                                        </div>
                                    </CardDescription>
                                    <CardDescription className="mt-2 flex items-center justify-center">
                                        <CreateAssessmentDashboardLogo
                                            className="mt-4 text-blue-600"
                                            fill="blue"
                                        />
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
