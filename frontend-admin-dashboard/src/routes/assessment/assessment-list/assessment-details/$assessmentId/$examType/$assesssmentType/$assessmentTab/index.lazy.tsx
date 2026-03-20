import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyButton } from '@/components/design-system/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
    getAssessmentDetails,
    getQuestionDataForSection,
} from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { DotIcon, DotIconOffline } from '@/svgs';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { CaretLeft, CheckCircle, LockSimple, PauseCircle, PencilSimpleLine } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import AssessmentPreview from './-components/AssessmentPreview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AssessmentOverviewTab from './-components/AssessmentOverviewTab';
import { AssessmentBasicInfoTab } from './-components/AssessmentBasicInfoTab';
import { AssessmentQuestionsTab } from './-components/AssessmentQuestionsTab';
import AssessmentSubmissionsTab from './-components/AssessmentSubmissionsTab';
import AssessmentParticipantsTab from './-components/AssessmentParticipantsTab';
import AssessmentAccessControlTab from './-components/AssessmentAccessControlTab';
import { SurveyMainOverviewTab } from './-components/survey/SurveyMainOverviewTab';
import { SurveyIndividualRespondentsTab } from './-components/survey/SurveyIndividualRespondentsTab';

export const Route = createLazyFileRoute(
    '/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/'
)({
    component: () => (
        <LayoutContainer>
            <AssessmentDetailsComponent />
        </LayoutContainer>
    ),
});

const heading = (
    <div className="flex items-center gap-4">
        <CaretLeft onClick={() => window.history.back()} className="cursor-pointer" />
        <h1 className="text-lg">Assessment Details</h1>
    </div>
);

// Helper components for better organization
const AssessmentHeader = ({ assessmentDetails }: { assessmentDetails: any }) => {
    const getVisibilityBadgeClass = (visibility: string) => {
        return visibility === 'PRIVATE' ? 'bg-primary-50' : 'bg-info-50';
    };

    const getModeBadgeClass = (mode: string) => {
        return mode !== 'EXAM' ? 'bg-neutral-50' : 'bg-success-50';
    };

    const getStatusBadgeClass = (status: string) => {
        return status === 'COMPLETED' ? 'bg-success-50' : 'bg-neutral-100';
    };

    const getStatusIcon = (status: string) => {
        return status === 'COMPLETED' ? (
            <CheckCircle size={16} weight="fill" className="mr-2 text-success-600" />
        ) : (
            <PauseCircle size={16} weight="fill" className="mr-2 text-neutral-400" />
        );
    };

    const getModeIcon = (mode: string) => {
        return mode === 'EXAM' ? (
            <DotIcon className="mr-2" />
        ) : (
            <DotIconOffline className="mr-2" />
        );
    };

    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h1 className="font-semibold text-lg sm:text-xl">{assessmentDetails[0]?.saved_data.name}</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <Badge
                    className={`rounded-md border border-neutral-300 ${getVisibilityBadgeClass(
                        assessmentDetails[0]?.saved_data.assessment_visibility
                    )} py-1.5 shadow-none`}
                >
                    <LockSimple size={16} className="mr-2" />
                    {assessmentDetails[0]?.saved_data.assessment_visibility}
                </Badge>
                <Badge
                    className={`rounded-md border border-neutral-300 ${getModeBadgeClass(
                        assessmentDetails[0]?.saved_data.assessment_mode
                    )} py-1.5 shadow-none`}
                >
                    {getModeIcon(assessmentDetails[0]?.saved_data.assessment_mode)}
                    {assessmentDetails[0]?.saved_data.assessment_mode}
                </Badge>
                <Separator orientation="vertical" className="h-8 w-px bg-neutral-300 hidden sm:block" />
                <Badge
                    className={`rounded-md border ${getStatusBadgeClass(
                        assessmentDetails?.[0]?.status
                    )} border-neutral-300 py-1.5 shadow-none`}
                >
                    {getStatusIcon(assessmentDetails?.[0]?.status)}
                    {assessmentDetails?.[0]?.status}
                </Badge>
            </div>
        </div>
    );
};

const AssessmentActions = ({
    isPreviewAssessmentDialogOpen,
    setIsPreviewAssessmentDialogOpen,
    questionsDataSectionWise,
    assessmentId
}: {
    isPreviewAssessmentDialogOpen: boolean;
    setIsPreviewAssessmentDialogOpen: (open: boolean) => void;
    questionsDataSectionWise: any;
    assessmentId: string;
}) => {
    const navigate = useNavigate();

    const handleOpenDialog = () => {
        if (Object.keys(questionsDataSectionWise).length === 0) {
            toast.error('No sections have been added for this assessment.');
        } else {
            setIsPreviewAssessmentDialogOpen(true);
        }
    };

    const handleExportAssessment = () => {
        if (Object.keys(questionsDataSectionWise).length === 0) {
            toast.error('No sections have been added for this assessment.');
        } else {
            navigate({
                to: '/assessment/export/$assessmentId',
                params: {
                    assessmentId: assessmentId,
                },
            });
        }
    };

    return (
        <div className="flex flex-col items-center gap-y-2">
            <Dialog
                open={isPreviewAssessmentDialogOpen}
                onOpenChange={setIsPreviewAssessmentDialogOpen}
            >
                <DialogTrigger>
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="secondary"
                        onClick={handleOpenDialog}
                    >
                        Preview Assessment
                    </MyButton>
                </DialogTrigger>
                {Object.keys(questionsDataSectionWise).length > 0 && (
                    <DialogContent className="no-scrollbar !m-0 h-[90vh] !w-[95vw] sm:!w-[90vw] !max-w-full !gap-0 overflow-y-auto !p-0 [&>button]:hidden">
                        <AssessmentPreview handleCloseDialog={() => setIsPreviewAssessmentDialogOpen(false)} />
                    </DialogContent>
                )}
            </Dialog>
            <MyButton scale="large" onClick={handleExportAssessment} className="py-4">
                Offline Paper
            </MyButton>
        </div>
    );
};

const AssessmentDetailsComponent = () => {
    const { assessmentId, examType, assesssmentType, assessmentTab } = Route.useParams();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const { data: assessmentDetails, isLoading } = useSuspenseQuery(
        getAssessmentDetails({
            assessmentId: assessmentId,
            instituteId: instituteDetails?.id,
            type: examType,
        })
    );

    const { data: questionsDataSectionWise, isLoading: isQuestionsLoading } = useSuspenseQuery(
        getQuestionDataForSection({
            assessmentId,
            sectionIds: assessmentDetails[1]?.saved_data.sections
                ?.map((section) => section.id)
                .join(','),
        })
    );

    const navigate = useNavigate();
    const [selectedTab, setSelectedTab] = useState('overview');
    const { setNavHeading } = useNavHeadingStore();

    const handleNavigateToSteps = () => {
        const tabMapping: Record<string, number> = {
            basicInfo: 0,
            questions: 1,
            participants: 2,
            accessControl: 3,
        };

        navigate({
            to: '/assessment/create-assessment/$assessmentId/$examtype',
            params: {
                assessmentId: assessmentId,
                examtype: examType,
            },
            search: {
                currentStep: tabMapping[selectedTab] ?? 0, // Default to 0 if tab is not found
            },
        });
    };

    const [isPreviewAssessmentDialogOpen, setIsPreviewAssessmentDialogOpen] = useState(false);

    useEffect(() => {
        setNavHeading(heading);
    }, []);

    if (isLoading || isQuestionsLoading) return <DashboardLoader />;

    return (
        <>
            <Helmet>
                <title>Assessment Details</title>
                <meta
                    name="description"
                    content="This page shows all details related to an assessment."
                />
            </Helmet>
            <div>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <AssessmentHeader assessmentDetails={assessmentDetails} />
                    <AssessmentActions
                        isPreviewAssessmentDialogOpen={isPreviewAssessmentDialogOpen}
                        setIsPreviewAssessmentDialogOpen={setIsPreviewAssessmentDialogOpen}
                        questionsDataSectionWise={questionsDataSectionWise}
                        assessmentId={assessmentId}
                    />
                </div>
                <Separator className="mt-4" />
                <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <TabsList className="mb-2 mt-6 inline-flex h-auto justify-start gap-0 rounded-none border-b !bg-transparent p-0 overflow-x-auto scrollbar-hide">
                            <TabsTrigger
                                value="overview"
                                className={`flex gap-1.5 rounded-none px-4 sm:px-12 py-2 !shadow-none whitespace-nowrap ${selectedTab === 'overview'
                                    ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                    : 'border-none bg-transparent'
                                    }`}
                            >
                                <span
                                    className={`${selectedTab === 'overview' ? 'text-primary-500' : ''
                                        }`}
                                >
                                    Overview
                                </span>
                            </TabsTrigger>
                            {assessmentTab !== 'upcomingTests' && (
                                <TabsTrigger
                                    value="submissions"
                                    className={`flex gap-1.5 rounded-none px-4 sm:px-12 py-2 !shadow-none whitespace-nowrap ${selectedTab === 'submissions'
                                        ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                        : 'border-none bg-transparent'
                                        }`}
                                >
                                    <span
                                        className={`${selectedTab === 'submissions' ? 'text-primary-500' : ''
                                            }`}
                                    >
                                        {examType === 'SURVEY' ? 'Individual Respondents' : 'Submissions'}
                                    </span>
                                </TabsTrigger>
                            )}
                            <TabsTrigger
                                value="basicInfo"
                                className={`flex gap-1.5 rounded-none px-4 sm:px-12 py-2 !shadow-none whitespace-nowrap ${selectedTab === 'basicInfo'
                                    ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                    : 'border-none bg-transparent'
                                    }`}
                            >
                                <span
                                    className={`${selectedTab === 'basicInfo' ? 'text-primary-500' : ''
                                        }`}
                                >
                                    Basic Info
                                </span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="questions"
                                className={`flex gap-1.5 rounded-none px-4 sm:px-12 py-2 !shadow-none whitespace-nowrap ${selectedTab === 'questions'
                                    ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                    : 'border-none bg-transparent'
                                    }`}
                            >
                                <span
                                    className={`${selectedTab === 'questions' ? 'text-primary-500' : ''
                                        }`}
                                >
                                    Questions
                                </span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="participants"
                                className={`flex gap-1.5 rounded-none px-4 sm:px-12 py-2 !shadow-none whitespace-nowrap ${selectedTab === 'participants'
                                    ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                    : 'border-none bg-transparent'
                                    }`}
                            >
                                <span
                                    className={`${selectedTab === 'participants' ? 'text-primary-500' : ''
                                        }`}
                                >
                                    Participants
                                </span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="accessControl"
                                className={`flex gap-1.5 rounded-none px-4 sm:px-12 py-2 !shadow-none whitespace-nowrap ${selectedTab === 'accessControl'
                                    ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                    : 'border-none bg-transparent'
                                    }`}
                            >
                                <span
                                    className={`${selectedTab === 'accessControl' ? 'text-primary-500' : ''
                                        }`}
                                >
                                    Access Control
                                </span>
                            </TabsTrigger>
                        </TabsList>
                        {selectedTab !== 'overview' && selectedTab !== 'submissions' && (
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="secondary"
                                className="mt-4 w-10 min-w-10 font-medium"
                                onClick={handleNavigateToSteps}
                            >
                                <PencilSimpleLine size={32} />
                            </MyButton>
                        )}
                    </div>
                    <div className="max-h-[72vh] overflow-y-auto pr-8 scrollbar-hide">
                        <TabsContent value="overview">
                            {examType === 'SURVEY' ? (
                                <SurveyMainOverviewTab
                                    assessmentId={assessmentId}
                                    sectionIds={assessmentDetails[1]?.saved_data.sections
                                        ?.map((section) => section.id)
                                        .join(',')}
                                    assessmentName={assessmentDetails[0]?.saved_data?.name || ''}
                                    assessmentDetails={{
                                        assessment_visibility: assessmentDetails[1]?.saved_data?.assessment_visibility,
                                        live_assessment_access: {
                                            batch_ids: assessmentDetails[1]?.saved_data?.live_assessment_access?.batch_ids ?? []
                                        }
                                    }}
                                />
                            ) : (
                                <AssessmentOverviewTab />
                            )}
                        </TabsContent>
                        <TabsContent value="submissions">
                            {examType === 'SURVEY' ? (
                                <SurveyIndividualRespondentsTab
                                    assessmentId={assessmentId}
                                    sectionIds={assessmentDetails[1]?.saved_data.sections
                                        ?.map((section) => section.id)
                                        .join(',')}
                                    assessmentName={assessmentDetails[0]?.saved_data?.name || ''}
                                    assessmentDetails={{
                                        assessment_visibility: assessmentDetails[1]?.saved_data?.assessment_visibility,
                                        live_assessment_access: {
                                            batch_ids: assessmentDetails[1]?.saved_data?.live_assessment_access?.batch_ids ?? []
                                        }
                                    }}
                                />
                            ) : (
                                <AssessmentSubmissionsTab type={assesssmentType} />
                            )}
                        </TabsContent>
                        <TabsContent value="basicInfo">
                            <AssessmentBasicInfoTab />
                        </TabsContent>
                        <TabsContent value="questions">
                            <AssessmentQuestionsTab />
                        </TabsContent>
                        <TabsContent value="participants">
                            <AssessmentParticipantsTab />
                        </TabsContent>
                        <TabsContent value="accessControl">
                            <AssessmentAccessControlTab />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </>
    );
};
