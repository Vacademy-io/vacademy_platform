import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { MyButton } from '@/components/design-system/button';
import { DotsThree, WarningCircle } from '@phosphor-icons/react';
import { AssessmentRevaluateStudentInterface } from '@/types/assessments/assessment-overview';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { StudentRevaluateQuestionWiseComponent } from './student-revaluate-question-wise-component';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { SelectedFilterRevaluateInterface } from '@/types/assessments/assessment-revaluate-question-wise';
import {
    getAttemptData,
    getReleaseStudentResult,
    getRevaluateStudentResult,
    handleGetStudentReportExportPDF,
    provideReattemptToParticipants,
    viewStudentReport,
} from '../../-services/assessment-details-services';
import { getPublicUrl } from '@/services/upload_file';
import { downloadFileFromUrl } from '@/lib/file-download';
import { Route } from '../..';
import { getInstituteId } from '@/constants/helper';
import { toast } from 'sonner';
import { SelectedReleaseResultFilterInterface } from '../AssessmentSubmissionsTab';
import { getAssessmentDetails } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services';
import {
    storeEvaluationDataInStorage,
    triggerAIEvaluation,
} from '../../-services/ai-evaluation-services';
import { MODEL_DISPLAY_NAMES } from '@/routes/ai-center/-types/ai-models';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { stashEvalReturnUrl } from '@/routes/evaluation/evaluation-tool/-utils/eval-return';
import { UploadAnswerSheetDialog } from '@/routes/evaluation/evaluate/$assessmentId/$attemptId/$examType/-components/UploadAnswerSheetDialog';

const ProvideReattemptComponent = ({
    student,
    onClose,
}: {
    student: AssessmentRevaluateStudentInterface;
    onClose: () => void;
}) => {
    const { assessmentId } = Route.useParams();
    const instituteId = getInstituteId();

    const provideReattemptMutation = useMutation({
        mutationFn: (registrationId: string) =>
            provideReattemptToParticipants(assessmentId, instituteId, [registrationId]),
        onSuccess: () => {
            toast.success(`Reattempt has been provided to ${student.full_name}.`, {
                className: 'success-toast',
                duration: 4000,
            });
            onClose();
        },
        onError: () => {
            toast.error('Failed to provide reattempt. Please try again.');
        },
    });

    const handleProvideReattempt = () => {
        if (!student.registration_id) {
            toast.error('Could not resolve this participant’s registration. Please try again.');
            return;
        }
        provideReattemptMutation.mutate(student.registration_id);
    };

    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Provide Reattempt</h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>Attention</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    Are you sure you want to provide a reattempt opportunity to{' '}
                    <span className="text-primary-500">{student.full_name}</span>?
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={handleProvideReattempt}
                        disabled={provideReattemptMutation.isPending}
                    >
                        {provideReattemptMutation.isPending ? 'Providing...' : 'Yes'}
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

const ReleaseResultComponent = ({
    student,
    onClose,
}: {
    student: AssessmentRevaluateStudentInterface;
    onClose: () => void;
}) => {
    const { assessmentId } = Route.useParams();
    const instituteId = getInstituteId();
    const getReleaseResultMutation = useMutation({
        mutationFn: ({
            assessmentId,
            instituteId,
            methodType,
            selectedFilter,
        }: {
            assessmentId: string;
            instituteId: string | undefined;
            methodType: string;
            selectedFilter: SelectedReleaseResultFilterInterface;
        }) => getReleaseStudentResult(assessmentId, instituteId, methodType, selectedFilter),
        onSuccess: () => {
            toast.success('Result released successfully. The learner has been notified by email.', {
                className: 'success-toast',
                duration: 4000,
            });
            onClose();
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handleReleaseResultStudent = () => {
        getReleaseResultMutation.mutate({
            assessmentId,
            instituteId,
            methodType: 'ENTIRE_ASSESSMENT_PARTICIPANTS',
            selectedFilter: {
                attempt_ids: [student.attempt_id],
            },
        });
    };
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Release Result</h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>Attention</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    Are you sure you want to release result for{' '}
                    <span className="text-primary-500">{student.full_name}</span>?
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={handleReleaseResultStudent} // Close the dialog when clicked
                    >
                        Yes
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

// Confirmation shown before opening the manual evaluation tool for an attempt
// that has already been evaluated. Re-grading resets its status to "Evaluating"
// until new marks are submitted, so warn the teacher first.
const ManualReEvaluateConfirmComponent = ({
    student,
    onConfirm,
    onClose,
}: {
    student: AssessmentRevaluateStudentInterface;
    onConfirm: () => void;
    onClose: () => void;
}) => {
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Re-evaluate Attempt</h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center gap-1 text-danger-600">
                    <p>Attention</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    <span className="text-primary-500">{student.full_name}</span>&apos;s attempt has
                    already been evaluated. Re-evaluating will move it back to{' '}
                    <span className="font-semibold">Evaluating</span> until you submit new marks. Do
                    you want to continue?
                </h1>
                <div className="mt-4 flex justify-end gap-2">
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        className="font-medium"
                        onClick={onClose}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="primary"
                        className="font-medium"
                        onClick={onConfirm}
                    >
                        Continue
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

const StudentEvaluateWithAIComponent = ({
    student,
    onClose,
    assessmentData,
    isReEvaluation,
}: {
    student: AssessmentRevaluateStudentInterface;
    onClose: () => void;
    assessmentData: any;
    isReEvaluation?: boolean;
}) => {
    const { assessmentId } = Route.useParams();
    const instituteId = getInstituteId();
    const navigate = useNavigate();
    const [selectedModel, setSelectedModel] = useState<string>('google/gemini-3.1-pro-preview');

    // Trigger AI evaluation mutation
    const triggerEvaluationMutation = useMutation({
        mutationFn: ({
            attempt_ids,
            preferred_model,
        }: {
            attempt_ids: string[];
            preferred_model?: string;
        }) => triggerAIEvaluation(attempt_ids, preferred_model),
        onSuccess: (processIds) => {
            toast.success(`AI evaluation started successfully!`, {
                className: 'success-toast',
                duration: 4000,
            });

            console.log('sections', assessmentData?.[1]?.saved_data?.sections);
            storeEvaluationDataInStorage({
                processId: processIds[0] ?? '',
                attemptId: student.attempt_id,
                assessmentId: assessmentId,
                sectionIds:
                    assessmentData?.[1]?.saved_data?.sections?.map((section: any) => section.id) ||
                    [],
            });
            onClose();

            // Navigate to the evaluation progress page
            navigate({
                to: '/assessment/evaluation-ai/$attemptId/$processId',
                params: {
                    attemptId: student.attempt_id,
                    processId: processIds[0] ?? '',
                },
            });
        },
        onError: (error: unknown) => {
            console.error('Failed to trigger AI evaluation:', error);
            toast.error('Failed to start AI evaluation. Please try again.');
        },
    });

    const handleEvaluateWithAIStudent = () => {
        triggerEvaluationMutation.mutate({
            attempt_ids: [student.attempt_id],
            preferred_model: selectedModel,
        });
    };

    return (
        <DialogContent className="flex flex-col gap-4 p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">
                Evaluate Assessment with AI
            </h1>
            <div className="flex flex-col gap-4 p-4">
                {isReEvaluation && (
                    <div className="flex items-start gap-2 rounded-md bg-danger-50 p-3 text-danger-600">
                        <WarningCircle size={18} className="mt-0.5 shrink-0" />
                        <p className="text-sm">
                            This attempt has already been evaluated. Re-evaluating will move it back
                            to <span className="font-semibold">Evaluating</span> until the new result
                            is ready.
                        </p>
                    </div>
                )}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-neutral-700">Select AI Model</label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(MODEL_DISPLAY_NAMES).map(([modelId, info]) => (
                                <SelectItem key={modelId} value={modelId}>
                                    {info.name} - {info.description}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-neutral-500">
                        Choose the AI model to evaluate{' '}
                        <span className="font-semibold text-primary-600">
                            {student.full_name}'s
                        </span>{' '}
                        submission
                    </p>
                </div>

                <div className="flex justify-end gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        onClick={onClose}
                        disabled={triggerEvaluationMutation.isPending}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        onClick={handleEvaluateWithAIStudent}
                        disabled={triggerEvaluationMutation.isPending}
                    >
                        {triggerEvaluationMutation.isPending ? 'Starting...' : 'Start'}
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

const StudentRevaluateForEntireAssessmentComponent = ({
    student,
    onClose,
}: {
    student: AssessmentRevaluateStudentInterface;
    onClose: () => void;
}) => {
    const { assessmentId } = Route.useParams();
    const instituteId = getInstituteId();
    const [selectedFilter] = useState<SelectedFilterRevaluateInterface>({
        questions: [
            {
                section_id: '',
                question_ids: [],
            },
        ],
        attempt_ids: [],
    });
    const getRevaluateResultMutation = useMutation({
        mutationFn: ({
            assessmentId,
            instituteId,
            methodType,
            selectedFilter,
        }: {
            assessmentId: string;
            instituteId: string | undefined;
            methodType: string;
            selectedFilter: SelectedFilterRevaluateInterface;
        }) => getRevaluateStudentResult(assessmentId, instituteId, methodType, selectedFilter),
        onSuccess: () => {
            toast.success(
                'Your attempt for this assessment has been revaluated. Please check your email!',
                {
                    className: 'success-toast',
                    duration: 4000,
                }
            );
            onClose();
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handleRevaluateStudent = () => {
        getRevaluateResultMutation.mutate({
            assessmentId,
            instituteId,
            methodType: 'ENTIRE_ASSESSMENT_PARTICIPANTS',
            selectedFilter: {
                ...selectedFilter,
                questions: [
                    {
                        section_id: '',
                        question_ids: [],
                    },
                ],
                attempt_ids: [student.attempt_id],
            },
        });
    };
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">
                Revaluate Entire Assessment
            </h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>Attention</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    Are you sure you want to revaluate for{' '}
                    <span className="text-primary-500">{student.full_name}</span> for the entire
                    assessment?
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={handleRevaluateStudent}
                    >
                        Yes
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

const StudentAttemptDropdown = ({ student }: { student: AssessmentRevaluateStudentInterface }) => {
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const { assessmentId, examType } = Route.useParams();
    const instituteId = getInstituteId();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Open the manual PDF evaluation tool for this attempt (same flow as the
    // assessment-slide "Evaluate" deep-link); return here after submitting.
    const handleManualEvaluate = () => {
        stashEvalReturnUrl(window.location.href);
        navigate({
            to: '/evaluation/evaluate/$assessmentId/$attemptId/$examType',
            params: {
                assessmentId,
                attemptId: student.attempt_id,
                examType: examType || 'EXAM',
            },
        });
    };

    // Fetch assessment details to get evaluation_type
    const { data: assessmentData } = useSuspenseQuery(
        getAssessmentDetails({
            assessmentId: assessmentId,
            instituteId: instituteId,
            type: 'EXAM', // You may need to get this from route params if needed
        })
    );

    const handleProvideReattempt = (value: string) => {
        setOpenDialog(true);
        setSelectedOption(value);
    };

    // Fetch the report detail for this attempt, resolve the evaluated copy's
    // public URL and open it. The evaluated_file_id lives on the report detail,
    // not on the table row, so it is fetched on demand.
    const viewEvaluatedMutation = useMutation({
        mutationFn: async () => {
            const report = await viewStudentReport(assessmentId, student.attempt_id, instituteId);
            const fileId = (report as { evaluated_file_id?: string | null } | undefined)
                ?.evaluated_file_id;
            if (!fileId) return null;
            return getPublicUrl(fileId);
        },
        onSuccess: (url) => {
            if (url) {
                // Download with a correct, `.pdf`-carrying name. The public URL's
                // basename is derived from the original upload name, which for
                // quick-evaluated copies can lack an extension — so we resolve
                // the real extension from the file itself before saving.
                void downloadFileFromUrl(url, `Evaluated-Copy-${student.full_name}`);
            } else {
                toast.error('No evaluated copy found for this attempt.');
            }
        },
        onError: (error: unknown) => {
            console.error('Failed to load evaluated copy:', error);
            toast.error('Failed to load the evaluated copy. Please try again.');
        },
    });

    const handleViewEvaluated = () => {
        if (viewEvaluatedMutation.isPending) return;
        viewEvaluatedMutation.mutate();
    };

    // Open the learner's actual submitted answer file. The attempt's uploaded
    // file id comes from getAttemptData; if there is no uploaded file (e.g. an
    // objective attempt) fall back to the generated submission report PDF.
    const viewSubmissionMutation = useMutation({
        mutationFn: async () => {
            const fileId = await getAttemptData(student.attempt_id);
            if (fileId) {
                const url = await getPublicUrl(fileId as string);
                return { type: 'url' as const, value: url };
            }
            const pdfBlob = await handleGetStudentReportExportPDF(
                assessmentId,
                instituteId,
                student.attempt_id
            );
            return { type: 'blob' as const, value: pdfBlob };
        },
        onSuccess: (result) => {
            const fileUrl =
                result.type === 'blob' ? window.URL.createObjectURL(result.value) : result.value;
            if (!fileUrl) {
                toast.error('No submission file found for this attempt.');
                return;
            }
            const submissionTab = window.open(fileUrl, '_blank');
            if (!submissionTab) {
                toast.error('Please allow pop-ups to view the submission.');
            }
            // Revoke object URLs after a delay so the new tab can load the blob.
            if (result.type === 'blob') {
                setTimeout(() => window.URL.revokeObjectURL(fileUrl), 60000);
            }
        },
        onError: (error: unknown) => {
            console.error('Failed to load submission:', error);
            toast.error('Failed to load submission. Please try again.');
        },
    });

    const handleViewSubmission = () => {
        if (viewSubmissionMutation.isPending) return;
        viewSubmissionMutation.mutate();
    };

    // Get evaluation_type from saved_data
    const evaluationType = assessmentData?.[0]?.saved_data?.evaluation_type;
    const isManualEvaluation = evaluationType === 'MANUAL';

    // Get evaluation_status from student data
    const evaluationStatus = student?.evaluation_status;
    const isEvaluationPending = evaluationStatus === 'PENDING';

    // For manual assessments the menu depends on whether the attempt has a
    // submitted answer sheet and an evaluated copy. Both live behind detail
    // endpoints (not on the table row), so fetch them lazily on menu open.
    const submissionFileQuery = useQuery({
        queryKey: ['GET_ATTEMPT_SUBMISSION_FILE', student.attempt_id],
        queryFn: async () => ((await getAttemptData(student.attempt_id)) as string | null) ?? null,
        enabled: isManualEvaluation && menuOpen,
        staleTime: 5 * 60 * 1000,
    });
    const reportDetailQuery = useQuery({
        queryKey: ['GET_STUDENT_REPORT_DETAIL', assessmentId, student.attempt_id],
        queryFn: () => viewStudentReport(assessmentId, student.attempt_id, instituteId),
        enabled: isManualEvaluation && menuOpen && !isEvaluationPending,
        staleTime: 5 * 60 * 1000,
    });
    const hasSubmissionFile = !!submissionFileQuery.data;
    const hasEvaluatedCopy = !!(
        reportDetailQuery.data as { evaluated_file_id?: string | null } | undefined
    )?.evaluated_file_id;

    // After an admin uploads the answer sheet on the student's behalf, flip the
    // cached file id (so the menu now shows "View Submission") and open the file.
    const handleAnswerSheetUploaded = async (fileId: string) => {
        queryClient.setQueryData(['GET_ATTEMPT_SUBMISSION_FILE', student.attempt_id], fileId);
        const url = await getPublicUrl(fileId);
        if (url) window.open(url, '_blank');
    };

    return (
        <>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger>
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="secondary"
                        className="w-6 !min-w-6"
                    >
                        <DotsThree />
                    </MyButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {/* Manual attempts may have no uploaded answer sheet — offer
                        the admin an upload instead of a dead "View Submission". */}
                    {isManualEvaluation ? (
                        submissionFileQuery.isLoading ? (
                            <DropdownMenuItem disabled>Checking Submission...</DropdownMenuItem>
                        ) : hasSubmissionFile ? (
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onSelect={(e) => {
                                    e.preventDefault();
                                    handleViewSubmission();
                                }}
                            >
                                {viewSubmissionMutation.isPending
                                    ? 'Loading Submission...'
                                    : 'View Submission'}
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => setUploadDialogOpen(true)}
                            >
                                Upload Submission
                            </DropdownMenuItem>
                        )
                    ) : (
                        <DropdownMenuItem
                            className="cursor-pointer"
                            onSelect={(e) => {
                                e.preventDefault();
                                handleViewSubmission();
                            }}
                        >
                            {viewSubmissionMutation.isPending
                                ? 'Loading Submission...'
                                : 'View Submission'}
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleProvideReattempt('Provide Reattempt')}
                    >
                        Provide Reattempt
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                            {isEvaluationPending ? 'Evaluate' : 'Revaluate'}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {!isManualEvaluation ? (
                                <>
                                    <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={() => handleProvideReattempt('Question Wise')}
                                    >
                                        Question Wise
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={() => handleProvideReattempt('Entire Assessment')}
                                    >
                                        Entire Assessment
                                    </DropdownMenuItem>
                                </>
                            ) : (
                                /* For MANUAL evaluation: grade by hand in the tool, or with AI */
                                <>
                                    <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={() => {
                                            // Already-evaluated attempts get a confirmation
                                            // (re-grading resets status to "Evaluating"); a
                                            // first-time evaluation opens the tool directly.
                                            if (isEvaluationPending) {
                                                handleManualEvaluate();
                                            } else {
                                                handleProvideReattempt('Manual Re-evaluate');
                                            }
                                        }}
                                    >
                                        Manual
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={() => handleProvideReattempt('Evaluate with AI')}
                                    >
                                        Evaluate with AI
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    {isManualEvaluation &&
                        !isEvaluationPending &&
                        (reportDetailQuery.isLoading ? (
                            <DropdownMenuItem disabled>
                                Checking Evaluated Copy...
                            </DropdownMenuItem>
                        ) : (
                            hasEvaluatedCopy && (
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        handleViewEvaluated();
                                    }}
                                >
                                    {viewEvaluatedMutation.isPending
                                        ? 'Loading Evaluated Copy...'
                                        : 'View Evaluated Copy'}
                                </DropdownMenuItem>
                            )
                        ))}
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleProvideReattempt('Release Result')}
                    >
                        Release Result
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Admin-side answer sheet upload for manual attempts that have no
                submission file. Lives outside the dropdown so it survives the
                menu closing. */}
            <UploadAnswerSheetDialog
                attemptId={student.attempt_id}
                instituteId={instituteId}
                open={uploadDialogOpen}
                onOpenChange={setUploadDialogOpen}
                onUploaded={handleAnswerSheetUploaded}
            />

            {/* Dialog should be controlled by openDialog state */}
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                {selectedOption === 'Provide Reattempt' && (
                    <ProvideReattemptComponent
                        student={student}
                        onClose={() => setOpenDialog(false)}
                    />
                )}
                {selectedOption === 'Question Wise' && (
                    <StudentRevaluateQuestionWiseComponent
                        student={student}
                        onClose={() => setOpenDialog(false)}
                    />
                )}
                {selectedOption === 'Entire Assessment' && (
                    <StudentRevaluateForEntireAssessmentComponent
                        student={student}
                        onClose={() => setOpenDialog(false)}
                    />
                )}
                {selectedOption === 'Release Result' && (
                    <ReleaseResultComponent
                        student={student}
                        onClose={() => setOpenDialog(false)}
                    />
                )}
                {selectedOption === 'Evaluate with AI' && (
                    <StudentEvaluateWithAIComponent
                        student={student}
                        onClose={() => setOpenDialog(false)}
                        assessmentData={assessmentData}
                        isReEvaluation={!isEvaluationPending}
                    />
                )}
                {selectedOption === 'Manual Re-evaluate' && (
                    <ManualReEvaluateConfirmComponent
                        student={student}
                        onConfirm={() => {
                            setOpenDialog(false);
                            handleManualEvaluate();
                        }}
                        onClose={() => setOpenDialog(false)}
                    />
                )}
            </Dialog>
        </>
    );
};

export default StudentAttemptDropdown;
