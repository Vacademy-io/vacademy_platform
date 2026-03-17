import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { ArrowLeft, Check, Circle, CheckCircle } from '@phosphor-icons/react';
import { useState, useEffect, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MyButton } from '@/components/design-system/button';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
    EvaluationData,
    getEvaluationProgress,
    useStopEvaluation,
} from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-services/ai-evaluation-services';
import { getInstituteId } from '@/constants/helper';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { getAssessmentDetails } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import {
    getQuestionDataForSection,
    getQuestionsDataForStep2,
} from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services';
import { getEvaluationDataFromStorage } from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-services/ai-evaluation-services';
import TipTapEditor from '@/components/tiptap/TipTapEditor';
import { MainViewQuillEditor } from '@/components/quill/MainViewQuillEditor';
import LatexRenderer from '../../-components/latex-renderer';
import {
    getAssessmentTotalMarks,
    getAttemptDetails,
} from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-services/assessment-details-services';

import { getPublicUrl } from '@/services/upload_file';
import { FileText } from '@phosphor-icons/react';
import SimplePDFViewer from '@/components/common/simple-pdf-viewer';
import { CaretLeft } from 'phosphor-react';

export const Route = createFileRoute('/assessment/evaluation-ai/$attemptId/$processId/')({
    component: RouteComponent,
});

const showStatusMessage = (status: string) => {
    switch (status) {
        case 'PENDING':
            return 'Evaluation is yet to start';
        case 'IN_PROGRESS':
            return 'Evaluation is in progress';
        case 'STARTED':
            return 'Evaluation has initiated';
        case 'PROCESSING':
            return 'Processing student answer sheet';
        case 'EXTRACTING':
            return 'Extracting Student Answers';
        case 'EVALUATING':
            return 'Evaluating Student Answers';
        case 'GRADING':
            return 'Grading evaluated answers';
        case 'COMPLETED':
            return 'Evaluation has completed';
        case 'FAILED':
            return 'Evaluation has failed';
        case 'CANCELLED':
            return 'Evaluation has been cancelled';
        default:
            return 'Unknown';
    }
};

function RouteComponent() {
    const { attemptId, processId } = Route.useParams();
    const navigate = useNavigate();
    const router = useRouter();
    const { setNavHeading } = useNavHeadingStore();
    const instituteId = getInstituteId();
    const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
    const [filterTab, setFilterTab] = useState<'all' | 'completed' | 'pending'>('all');
    const [startTime] = useState(Date.now());
    const [isStopEvaluation, setIsStopEvaluation] = useState(false);
    const [isPdfPanelOpen, setIsPdfPanelOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isLoadingPdf, setIsLoadingPdf] = useState(false);
    const [duration, setDuration] = useState('0s');

    const { data: attemptDetails, isLoading: isAttemptLoading } = useQuery({
        ...getAttemptDetails(attemptId),
    });

    // Get section IDs from localStorage
    const evaluationData = getEvaluationDataFromStorage().find(
        (data: any) => data.processId === processId
    );
    const sectionIds = evaluationData?.sectionIds?.join(',');
    const assessmentId = evaluationData?.assessmentId;

    const {
        data: progress,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['EVALUATION_PROGRESS', processId],
        queryFn: () => getEvaluationProgress(processId),
        refetchInterval: (query) => {
            // Stop polling if completed or failed
            const status = query?.state.data?.overall_status;
            if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
                return false;
            }
            return 6000; // Poll every 6 seconds
        },
        staleTime: 0,
        enabled: !!processId && !isStopEvaluation,
    });

    const stopEvaluationMutation = useMutation({
        ...useStopEvaluation(),
        onSuccess: () => {
            toast.success('Evaluation stopped successfully!');
            setIsStopEvaluation(true);
        },
        onError: () => {
            toast.error('Failed to stop evaluation');
        },
    });

    const { data: assessmentData } = useQuery({
        ...getAssessmentDetails({
            assessmentId: assessmentId,
            instituteId: instituteId,
            type: 'EXAM',
        }),
    });

    const { data: totalMarks } = useQuery({
        queryKey: ['TOTAL_MARKS', assessmentId],
        queryFn: () => getAssessmentTotalMarks(assessmentId),
    });

    const { data: questionsData, isLoading: isLoadingQuestions } = useQuery({
        queryKey: ['SECTION_QUESTIONS', sectionIds, assessmentId],
        queryFn: async () => {
            const data = await getQuestionsDataForStep2({
                assessmentId: assessmentId ?? '',
                sectionIds,
            });
            return data;
        },
    });

    useEffect(() => {
        // Stop timer if evaluation is completed or failed
        if (
            progress?.overall_status === 'COMPLETED' ||
            progress?.overall_status === 'FAILED' ||
            progress?.overall_status === 'CANCELLED'
        ) {
            return;
        }

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            setDuration(`${minutes}m ${seconds}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime, progress?.overall_status]);

    // Handle completion
    useEffect(() => {
        if (progress?.overall_status === 'COMPLETED') {
            toast.success('Evaluation completed successfully!', {
                duration: 5000,
            });
        } else if (progress?.overall_status === 'FAILED') {
            toast.error('Evaluation failed. Please try again.', {
                duration: 5000,
            });
        }
    }, [progress?.overall_status]);

    useEffect(() => {
        const heading = (
            <div className="flex items-center gap-4">
                <CaretLeft onClick={() => router.history.back()} className="cursor-pointer" />
                <div>Evaluation Progress</div>
            </div>
        );
        setNavHeading(heading);
    }, []);

    const allSectionQuestions = questionsData ? Object.values(questionsData).flat() : [];

    // Calculate total score
    const totalScore =
        progress?.completed_questions.reduce((sum, q) => sum + (q.marks_awarded || 0), 0) || 0;
    const maxScore = totalMarks?.total_achievable_marks || 0;
    const allQuestions = progress
        ? [...progress.completed_questions, ...progress.pending_questions]
        : [];
    const filteredQuestions =
        filterTab === 'all'
            ? allQuestions
            : filterTab === 'completed'
              ? progress?.completed_questions || []
              : progress?.pending_questions || [];

    const toggleQuestion = (question_id: string) => {
        setExpandedQuestion(expandedQuestion === question_id ? null : question_id);
    };

    const showShimmer = (status: string) => {
        return status === 'STARTED' || status === 'PROCESSING' || status === 'EXTRACTING';
    };

    const handleViewAnswerSheet = async () => {
        if (isPdfPanelOpen) {
            setIsPdfPanelOpen(false);
            return;
        }

        if (pdfUrl) {
            setIsPdfPanelOpen(true);
            return;
        }

        if (!attemptDetails) {
            toast.error('Answer sheet not available');
            return;
        }

        setIsLoadingPdf(true);
        try {
            const url = await getPublicUrl(attemptDetails);
            if (url) {
                setPdfUrl(url);
                setIsPdfPanelOpen(true);
            } else {
                toast.error('Failed to load answer sheet');
            }
        } catch (error) {
            console.error('Error loading PDF:', error);
            toast.error('Failed to load answer sheet');
        } finally {
            setIsLoadingPdf(false);
        }
    };

    if (isLoading || !progress) {
        return <DashboardLoader />;
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-neutral-50">
                <div className="text-center">
                    <h2 className="mb-2 text-xl font-bold text-red-600">Error Loading Progress</h2>
                    <p className="text-neutral-600">
                        {error instanceof Error
                            ? error.message
                            : 'Failed to load evaluation progress'}
                    </p>
                    <MyButton onClick={() => navigate({ to: -1 as any })} className="mt-4">
                        Go Back
                    </MyButton>
                </div>
            </div>
        );
    }

    const userFullName = progress?.participant_details?.name || 'Loading...';
    const assessmentName = assessmentData?.[0]?.saved_data?.name || 'Loading...';

    return (
        <LayoutContainer>
            <div className="flex gap-6 transition-all duration-300 ease-in-out">
                {/* Left Panel - Evaluation Content */}
                <div
                    className={`${isPdfPanelOpen ? 'w-1/2' : 'w-full'} transition-all duration-300`}
                >
                    {/* Header */}
                    <Card className="mb-2 flex items-center justify-between">
                        <CardContent className="p-4">
                            <p className="mb-1 text-sm text-neutral-600">Participant</p>
                            <p className="text-sm font-medium">{userFullName}</p>
                        </CardContent>
                        <CardContent className="p-4">
                            <p className="mb-1 text-sm text-neutral-600">Assessment</p>
                            <p className="text-sm font-medium">{assessmentName}</p>
                        </CardContent>
                        <CardContent className="p-4">
                            <p className="mb-1 text-sm text-neutral-600">Status</p>
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">{progress.overall_status}</p>
                            </div>
                        </CardContent>
                        <CardContent className="p-4">
                            <p className="mb-1 text-sm text-neutral-600">Duration</p>
                            <p className="text-sm font-medium">{duration}</p>
                        </CardContent>
                        <CardContent className="w-1/2 p-4">
                            <p className="mb-1 text-sm text-neutral-600">Progress</p>
                            <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                                <div
                                    className="h-full bg-primary-500 transition-all"
                                    style={{ width: `${progress.progress.percentage}%` }}
                                />
                            </div>
                            <p className="text-sm font-medium">
                                {progress.progress.completed}/{progress.progress.total}
                            </p>
                        </CardContent>
                        {progress.overall_status !== 'COMPLETED' &&
                            progress.overall_status !== 'FAILED' &&
                            progress.overall_status !== 'CANCELLED' && (
                                <CardContent className="p-4">
                                    <MyButton
                                        onClick={() => stopEvaluationMutation.mutate(processId)}
                                        disabled={stopEvaluationMutation.isPending}
                                        className="bg-red-600 hover:bg-red-700"
                                        scale={'small'}
                                    >
                                        {stopEvaluationMutation.isPending ? 'Stopping...' : 'Stop'}
                                    </MyButton>
                                </CardContent>
                            )}
                    </Card>

                    {/* Summary Stats */}
                    <Card className="my-2 flex items-center justify-between">
                        <CardContent className="flex gap-8 p-4">
                            <div>
                                <p className="text-sm text-neutral-600">Total Score</p>
                                <p className="text-2xl font-bold">
                                    {totalScore.toFixed(1)}/{maxScore}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-neutral-600">Percentage</p>
                                <p className="text-2xl font-bold">
                                    {maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : 0}%
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-neutral-600">Completed</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {progress.progress.completed}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-neutral-600">Pending</p>
                                <p className="text-2xl font-bold text-orange-600">
                                    {progress.progress.total - progress.progress.completed}
                                </p>
                            </div>
                        </CardContent>

                        {/* Filter Tabs */}
                        <CardContent className="flex items-center gap-2 p-4">
                            <MyButton
                                buttonType={filterTab === 'all' ? 'primary' : 'secondary'}
                                onClick={() => setFilterTab('all')}
                                scale={'small'}
                            >
                                All
                            </MyButton>
                            <MyButton
                                buttonType={filterTab === 'completed' ? 'primary' : 'secondary'}
                                onClick={() => setFilterTab('completed')}
                                scale={'small'}
                            >
                                Completed
                            </MyButton>
                            <MyButton
                                buttonType={filterTab === 'pending' ? 'primary' : 'secondary'}
                                onClick={() => setFilterTab('pending')}
                                scale={'small'}
                            >
                                Pending
                            </MyButton>

                            {/* View Answer Sheet Button */}
                            {attemptDetails && !isPdfPanelOpen && (
                                <MyButton
                                    onClick={handleViewAnswerSheet}
                                    disabled={isLoadingPdf}
                                    buttonType={isPdfPanelOpen ? 'primary' : 'secondary'}
                                    scale={'small'}
                                    className="flex items-center gap-2"
                                >
                                    <FileText size={16} />
                                    {isLoadingPdf ? 'Loading...' : 'Answer Sheet'}
                                </MyButton>
                            )}
                        </CardContent>
                    </Card>

                    {/* Question List */}
                    <div className="space-y-4">
                        <div className="mb-6 rounded-lg bg-blue-50 p-4 text-center">
                            <p className="text-sm font-medium text-blue-700">
                                {showStatusMessage(progress.overall_status)}
                            </p>
                        </div>

                        {filteredQuestions.length === 0 && !showShimmer(progress.overall_status) ? (
                            <div className="rounded-lg bg-white p-8 text-center shadow">
                                <p className="text-neutral-600">
                                    No {filterTab === 'all' ? '' : filterTab} questions to display
                                </p>
                            </div>
                        ) : (
                            filteredQuestions.map((question) => {
                                // Find matching question details from API
                                const questionDetails = allSectionQuestions.find(
                                    (q: any) => q.question_id === question.question_id
                                );

                                return (
                                    <QuestionCard
                                        key={question.question_id}
                                        question={question}
                                        isExpanded={expandedQuestion === question.question_id}
                                        onToggle={() => toggleQuestion(question.question_id)}
                                        questionDetails={questionDetails}
                                    />
                                );
                            })
                        )}
                        {showShimmer(progress.overall_status) && (
                            <>
                                <div className="space-y-4">
                                    {[1, 2, 3].map((index) => (
                                        <Card
                                            key={index}
                                            className="animate-pulse overflow-hidden border-2 border-neutral-200"
                                        >
                                            <div className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="size-10 rounded-lg bg-neutral-300" />
                                                        <div className="space-y-2">
                                                            <div className="h-4 w-32 rounded bg-neutral-300" />
                                                            <div className="h-3 w-24 rounded bg-neutral-200" />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="space-y-2 text-right">
                                                            <div className="h-8 w-12 rounded bg-neutral-300" />
                                                            <div className="h-3 w-12 rounded bg-neutral-200" />
                                                        </div>
                                                        <div className="size-6 rounded-full bg-neutral-300" />
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Right Panel - PDF Viewer */}
                {isPdfPanelOpen && (
                    <div className="w-1/2 transition-all duration-300">
                        <div className="sticky top-6 h-[calc(100vh-100px)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
                            <div className="flex items-center justify-between border-b bg-neutral-50 px-4 py-3">
                                <h3 className="font-semibold text-neutral-700">
                                    Student Answer Sheet
                                </h3>
                                <button
                                    onClick={() => setIsPdfPanelOpen(false)}
                                    className="text-neutral-500 hover:text-neutral-700"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="h-full w-full bg-neutral-100 p-4">
                                {pdfUrl ? (
                                    <Suspense
                                        fallback={
                                            <div className="flex h-full w-full animate-pulse items-center justify-center rounded bg-gray-100">
                                                Loading PDF...
                                            </div>
                                        }
                                    >
                                        <SimplePDFViewer pdfUrl={pdfUrl} />
                                    </Suspense>
                                ) : (
                                    <div className="flex h-full items-center justify-center">
                                        <DashboardLoader />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </LayoutContainer>
    );
}

interface QuestionCardProps {
    question: any;
    isExpanded: boolean;
    onToggle: () => void;
    questionDetails?: any;
}

function QuestionCard({ question, isExpanded, onToggle, questionDetails }: QuestionCardProps) {
    const isCompleted = question.status === 'COMPLETED';
    const completedTime = question.completed_at
        ? formatDistanceToNow(new Date(question.completed_at), { addSuffix: true })
        : '';

    // Parse evaluation_json to get correct option IDs
    const evaluationJson = questionDetails?.evaluation_json
        ? JSON.parse(questionDetails.evaluation_json)
        : null;
    const correctOptionIds = evaluationJson?.data?.correctOptionIds || [];

    // Extract max marks from questionDetails as fallback
    const markingJson = questionDetails?.marking_json
        ? JSON.parse(questionDetails.marking_json)
        : null;
    const maxMarksFromQuestionDetails = markingJson?.data?.totalMark
        ? parseFloat(markingJson.data.totalMark)
        : 0;

    // Use question.max_marks if available, otherwise fall back to questionDetails
    const maxMarks = question.max_marks ?? maxMarksFromQuestionDetails;

    return (
        <Card
            className={`overflow-hidden border-2 transition-all ${
                isCompleted ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'
            }`}
        >
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full p-4 text-left transition-colors hover:bg-black/5"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-white font-bold">
                            Q{question.question_number}
                        </div>
                        <div>
                            <h3 className="font-semibold">Question {question.question_number}</h3>
                            {isCompleted && (
                                <p className="text-sm text-neutral-600">
                                    Completed {completedTime}
                                </p>
                            )}
                            {!isCompleted && <p className="text-sm text-neutral-600">Pending</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {isCompleted ? (
                            <>
                                <div className="text-right">
                                    <p className="text-2xl font-bold">
                                        {question.marks_awarded?.toFixed(1) || 0}
                                    </p>
                                    <p className="text-sm text-neutral-600">/ {maxMarks}</p>
                                </div>
                                <CheckCircle size={24} className="text-green-600" weight="fill" />
                            </>
                        ) : (
                            <Circle size={24} className="animate-spin text-orange-500" />
                        )}
                    </div>
                </div>
            </button>

            {/* Expanded Content - Show for ALL questions (pending and completed) */}
            {isExpanded && (
                <div className="space-y-6 border-t-2 border-green-300 bg-white p-6">
                    {/* Question Text */}
                    {questionDetails?.question?.content && (
                        <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                                Question
                            </h4>

                            <TipTapEditor
                                value={questionDetails.question.content}
                                onChange={() => {}}
                                editable={false}
                            />
                        </div>
                    )}

                    {/* Correct Answer (for MCQ) */}
                    {questionDetails?.question_type === 'MCQS' &&
                        questionDetails?.options_with_explanation &&
                        correctOptionIds.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                                    Correct Answer
                                </h4>
                                <div className="rounded-md bg-green-50 p-3">
                                    {questionDetails.options_with_explanation
                                        .filter((opt: any) => correctOptionIds.includes(opt.id))
                                        .map((opt: any, idx: number) => (
                                            <TipTapEditor
                                                key={idx}
                                                value={opt.text.content}
                                                onChange={() => {}}
                                                editable={false}
                                                // className="h-fit bg-red-400"
                                            />
                                        ))}
                                </div>
                            </div>
                        )}

                    {/* Student's Answer */}
                    {question.extracted_answer && (
                        <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                                Student's Answer
                            </h4>
                            <Card className="rounded-sm p-4">
                                <LatexRenderer
                                    content={question.extracted_answer}
                                    className="text-base"
                                />
                            </Card>
                        </div>
                    )}

                    {/* Feedback */}
                    {question.feedback && (
                        <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                                Feedback
                            </h4>
                            <p className="rounded-md bg-neutral-50 p-3 text-sm">
                                {question.feedback}
                            </p>
                        </div>
                    )}

                    {/* Criteria Breakdown */}
                    {question.evaluation_details_json?.criteria_breakdown && (
                        <div>
                            <h4 className="mb-3 text-xs font-semibold uppercase text-neutral-500">
                                Grading Breakdown
                            </h4>
                            <div className="overflow-hidden rounded-md border border-neutral-200">
                                <table className="w-full">
                                    <thead className="bg-neutral-100">
                                        <tr>
                                            <th className="p-3 text-left text-xs font-semibold uppercase text-neutral-600">
                                                Criteria
                                            </th>
                                            <th className="p-3 text-left text-xs font-semibold uppercase text-neutral-600">
                                                Reason
                                            </th>
                                            <th className="w-24 p-3 text-right text-xs font-semibold uppercase text-neutral-600">
                                                Marks
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200">
                                        {question.evaluation_details_json.criteria_breakdown.map(
                                            (criteria: any, index: number) => (
                                                <tr key={index} className="hover:bg-neutral-50">
                                                    <td className="p-3 text-sm font-medium text-neutral-900">
                                                        {criteria.criteria_name}
                                                    </td>
                                                    <td className="p-3 text-sm text-neutral-600">
                                                        {criteria.reason}
                                                    </td>
                                                    <td className="p-3 text-right text-sm font-semibold text-neutral-900">
                                                        {criteria.marks.toFixed(1)}
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                        <tr className="bg-primary-50">
                                            <td
                                                colSpan={2}
                                                className="p-3 text-right text-sm font-semibold text-primary-700"
                                            >
                                                Total Marks Awarded:
                                            </td>
                                            <td className="p-3 text-right text-sm font-bold text-primary-700">
                                                {question.marks_awarded?.toFixed(1) || 0}
                                                {maxMarks && ` / ${maxMarks}`}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
