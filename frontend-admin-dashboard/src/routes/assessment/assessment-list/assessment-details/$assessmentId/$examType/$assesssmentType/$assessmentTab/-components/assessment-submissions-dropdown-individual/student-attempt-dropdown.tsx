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
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { SelectedFilterRevaluateInterface } from '@/types/assessments/assessment-revaluate-question-wise';
import {
    getReleaseStudentResult,
    getRevaluateStudentResult,
} from '../../-services/assessment-details-services';
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

const ProvideReattemptComponent = ({
    student,
    onClose,
}: {
    student: AssessmentRevaluateStudentInterface;
    onClose: () => void;
}) => {
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
                        onClick={onClose} // Close the dialog when clicked
                    >
                        Yes
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

const StudentEvaluateWithAIComponent = ({
    student,
    onClose,
    assessmentData,
}: {
    student: AssessmentRevaluateStudentInterface;
    onClose: () => void;
    assessmentData: any;
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
    const { assessmentId } = Route.useParams();
    const instituteId = getInstituteId();

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

    // Get evaluation_type from saved_data
    const evaluationType = assessmentData?.[0]?.saved_data?.evaluation_type;
    const isManualEvaluation = evaluationType === 'MANUAL';

    // Get evaluation_status from student data
    const evaluationStatus = student?.evaluation_status;
    const isEvaluationPending = evaluationStatus === 'PENDING';

    return (
        <>
            <DropdownMenu>
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
                                /* Show "Evaluate with AI" if evaluation_type is MANUAL */
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => handleProvideReattempt('Evaluate with AI')}
                                >
                                    Evaluate with AI
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleProvideReattempt('Release Result')}
                    >
                        Release Result
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

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
                    />
                )}
            </Dialog>
        </>
    );
};

export default StudentAttemptDropdown;
