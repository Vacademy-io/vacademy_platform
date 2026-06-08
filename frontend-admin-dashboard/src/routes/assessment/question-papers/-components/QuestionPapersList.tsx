import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, CheckSquare, DotsThree, Shuffle, Star } from '@phosphor-icons/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MyPagination } from '@/components/design-system/pagination';
import ViewQuestionPaper from './ViewQuestionPaper';
import { useMutation } from '@tanstack/react-query';
import { getQuestionPaperById, markQuestionPaperStatus } from '../-utils/question-paper-services';
import {
    PaginatedResponse,
    QuestionPaperInterface,
} from '@/types/assessments/question-paper-template';
import {
    getLevelNameById,
    getSubjectNameById,
    transformResponseDataToMyQuestionsSchema,
} from '../-utils/helper';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import useDialogStore from '../-global-states/question-paper-dialogue-close';
import { MyQuestion } from '@/types/assessments/question-paper-form';
import { z } from 'zod';
import sectionDetailsSchema from '../../create-assessment/$assessmentId/$examtype/-utils/section-details-schema';
import { UseFormReturn } from 'react-hook-form';
import { Dispatch, SetStateAction, useState } from 'react';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import ExportQuestionPaper from './export-question-paper/ExportQuestionPaper';
import { AssignmentFormType } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-form-schemas/assignmentFormSchema';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';
export type SectionFormType = z.infer<typeof sectionDetailsSchema>;
export const QuestionPapersList = ({
    questionPaperList,
    pageNo,
    handlePageChange,
    refetchData,
    isAssessment,
    index,
    sectionsForm,
    studyLibraryAssignmentForm,
    isStudyLibraryAssignment,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    examType,
    onManualSelectionReady,
}: {
    questionPaperList: PaginatedResponse;
    pageNo: number;
    handlePageChange: (newPage: number) => void;
    refetchData: () => void;
    isAssessment: boolean;
    index?: number;
    sectionsForm?: UseFormReturn<SectionFormType>;
    studyLibraryAssignmentForm?: UseFormReturn<AssignmentFormType>;
    isStudyLibraryAssignment?: boolean;
    currentQuestionIndex: number;
    setCurrentQuestionIndex: Dispatch<SetStateAction<number>>;
    examType?: string;
    onManualSelectionReady?: (questions: MyQuestion[]) => void;
}) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];

    const { setIsSavedQuestionPaperDialogOpen } = useDialogStore();
    const { instituteDetails } = useInstituteDetailsStore();

    // Selection config state — shown after user clicks a paper in assessment mode
    const [pendingPaper, setPendingPaper] = useState<QuestionPaperInterface | null>(null);
    const [selectionMode, setSelectionMode] = useState<'all' | 'random' | 'manual'>('all');
    const [questionCount, setQuestionCount] = useState('');

    const resetSelectionConfig = () => {
        setPendingPaper(null);
        setSelectionMode('all');
        setQuestionCount('');
    };

    const handleMarkQuestionPaperStatus = useMutation({
        mutationFn: ({
            status,
            questionPaperId,
            instituteId,
        }: {
            status: string;
            questionPaperId: string;
            instituteId: string | undefined;
        }) => markQuestionPaperStatus(status, questionPaperId, instituteId),
        onSuccess: () => {
            refetchData();
        },
        onError: (error: unknown) => {
            console.error(error);
        },
    });

    const handleMarkFavourite = (questionPaperId: string, status: string) => {
        handleMarkQuestionPaperStatus.mutate({
            status: status === 'FAVOURITE' ? 'ACTIVE' : 'FAVOURITE',
            questionPaperId,
            instituteId: INSTITUTE_ID,
        });
    };

    const handleDeleteQuestionPaper = (questionPaperId: string) => {
        handleMarkQuestionPaperStatus.mutate({
            status: 'DELETE',
            questionPaperId,
            instituteId: INSTITUTE_ID,
        });
    };

    const handleGetQuestionPaperData = useMutation({
        mutationFn: ({ id }: { id: string }) => getQuestionPaperById(id),
        onSuccess: async (data, { id }) => {
            const transformQuestionsData: MyQuestion[] = transformResponseDataToMyQuestionsSchema(
                data.question_dtolist
            );

            // Manual mode: close outer dialog, then hand questions to parent for standalone selector
            if (selectionMode === 'manual' && sectionsForm && index !== undefined) {
                setIsSavedQuestionPaperDialogOpen(false);
                resetSelectionConfig();
                onManualSelectionReady?.(transformQuestionsData);
                return;
            }

            setIsSavedQuestionPaperDialogOpen(false);
            resetSelectionConfig();
            if (isStudyLibraryAssignment) {
                studyLibraryAssignmentForm?.setValue('uploaded_question_paper', id);
                studyLibraryAssignmentForm?.setValue(
                    `adaptive_marking_for_each_question`,
                    transformQuestionsData.map((question) => {
                        let rawOptions: { id?: string; name?: string }[] = [];
                        if (question.questionType === 'MCQS' || question.questionType === 'CMCQS') {
                            rawOptions = question.singleChoiceOptions || question.csingleChoiceOptions || [];
                        } else if (question.questionType === 'MCQM' || question.questionType === 'CMCQM') {
                            rawOptions = question.multipleChoiceOptions || question.cmultipleChoiceOptions || [];
                        } else if (question.questionType === 'TRUE_FALSE') {
                            rawOptions = question.trueFalseOptions || [];
                        }
                        return {
                            questionId: question.questionId,
                            questionName: question.questionName,
                            questionType: question.questionType,
                            newQuestion: true,
                            options: rawOptions
                                .filter((opt) => opt.id || opt.name)
                                .map((opt) => ({
                                    id: opt.id || '',
                                    text: { content: opt.name || '' },
                                })),
                        };
                    })
                );
            }
            if (sectionsForm && index !== undefined) {
                let questionsToUse = transformQuestionsData;
                if (selectionMode === 'random') {
                    const count = parseInt(questionCount || '0');
                    if (count > 0 && count < questionsToUse.length) {
                        questionsToUse = [...questionsToUse]
                            .sort(() => Math.random() - 0.5)
                            .slice(0, count);
                    }
                }
                sectionsForm.setValue(
                    `section.${index}.adaptive_marking_for_each_question`,
                    questionsToUse.map((question) => ({
                        questionId: question.questionId,
                        questionName: question.questionName,
                        questionType: question.questionType,
                        questionMark: question.questionMark,
                        questionPenalty: question.questionPenalty,
                        ...(question.questionType === 'MCQM' && {
                            correctOptionIdsCnt: question?.multipleChoiceOptions?.filter(
                                (item) => item.isSelected
                            ).length,
                        }),
                        questionDuration: {
                            hrs: question.questionDuration.hrs,
                            min: question.questionDuration.min,
                        },
                    }))
                );
                sectionsForm.trigger(`section.${index}.adaptive_marking_for_each_question`);
            }
        },
        onError: (error: unknown) => {
            console.error(error);
        },
    });

    const handleConfirmSelection = () => {
        if (!pendingPaper) return;
        const id = pendingPaper.id;
        if (sectionsForm && index !== undefined) {
            const currentSection = sectionsForm.getValues(`section.${index}`);
            const subjectName = getSubjectNameById(
                instituteDetails?.subjects || [],
                pendingPaper.subject_id
            );
            const newSectionName =
                currentSection.sectionName &&
                currentSection.sectionName !== 'N/A' &&
                currentSection.sectionName !== '' &&
                !currentSection.sectionName.startsWith('Section ')
                    ? currentSection.sectionName
                    : (subjectName && subjectName !== 'N/A'
                          ? subjectName
                          : currentSection.sectionName) || `Section ${index + 1}`;
            sectionsForm.setValue(`section.${index}`, {
                ...currentSection,
                questionPaperTitle: pendingPaper.title,
                subject: subjectName,
                yearClass: getLevelNameById(instituteDetails?.levels || [], pendingPaper.level_id),
                sectionName: newSectionName,
                uploaded_question_paper: id,
            });
        }
        handleGetQuestionPaperData.mutate({ id });
    };

    const handleGetQuestionPaperDataById = (questionsData: QuestionPaperInterface) => {
        // In assessment mode, show selection config before loading
        if (isAssessment && index !== undefined) {
            setPendingPaper(questionsData);
            return;
        }

        const id = questionsData.id;

        if (sectionsForm && index !== undefined) {
            const currentSection = sectionsForm.getValues(`section.${index}`);
            const subjectName = getSubjectNameById(
                instituteDetails?.subjects || [],
                questionsData.subject_id
            );

            const newSectionName = currentSection.sectionName &&
                           currentSection.sectionName !== 'N/A' &&
                           currentSection.sectionName !== '' &&
                           !currentSection.sectionName.startsWith('Section ')
                    ? currentSection.sectionName
                    : ((subjectName && subjectName !== 'N/A') ? subjectName : currentSection.sectionName) || `Section ${index + 1}`;

            sectionsForm.setValue(`section.${index}`, {
                ...currentSection,
                questionPaperTitle: questionsData.title,
                subject: subjectName,
                yearClass: getLevelNameById(instituteDetails?.levels || [], questionsData.level_id),
                sectionName: newSectionName,
                uploaded_question_paper: id,
            });
        }

        handleGetQuestionPaperData.mutate({ id });
    };

    if (
        (index !== undefined || isStudyLibraryAssignment) &&
        handleGetQuestionPaperData.status === 'pending'
    )
        return <DashboardLoader />;

    // Selection config step — shown after user picks a paper in assessment mode
    if (pendingPaper) {
        const count = parseInt(questionCount || '0');
        const isCountValid = selectionMode === 'all' || selectionMode === 'manual' || count > 0;
        return (
            <div className="mt-4 w-full overflow-x-hidden flex flex-col gap-6 px-1">
                <button
                    type="button"
                    className="flex items-center gap-1 self-start text-sm text-neutral-500 hover:text-neutral-700"
                    onClick={resetSelectionConfig}
                >
                    <ArrowLeft size={14} />
                    Back to list
                </button>

                <div className="w-full rounded-lg border border-neutral-200 bg-primary-50 p-4">
                    <p className="truncate text-sm font-medium text-neutral-800">{pendingPaper.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                        Created on {new Date(pendingPaper.created_on).toLocaleDateString()}
                    </p>
                </div>

                <div className="w-full flex flex-col gap-3">
                    <p className="text-sm font-medium text-neutral-700">How many questions to include?</p>
                    <RadioGroup
                        value={selectionMode}
                        onValueChange={(v) => {
                            setSelectionMode(v as 'all' | 'random' | 'manual');
                            setQuestionCount('');
                        }}
                        className="flex flex-col gap-3"
                    >
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="all" id="config-all" />
                            <label htmlFor="config-all" className="cursor-pointer text-sm text-neutral-700">
                                All Questions
                            </label>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <RadioGroupItem value="random" id="config-random" />
                            <label htmlFor="config-random" className="cursor-pointer text-sm text-neutral-700">
                                Random Selection
                            </label>
                            {selectionMode === 'random' && (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        placeholder="e.g. 20"
                                        min={1}
                                        className="h-8 w-24"
                                        value={questionCount}
                                        onChange={(e) => setQuestionCount(e.target.value)}
                                    />
                                    <span className="text-xs text-neutral-400">questions</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="manual" id="config-manual" />
                            <label htmlFor="config-manual" className="cursor-pointer text-sm text-neutral-700">
                                Select Manually
                            </label>
                            {selectionMode === 'manual' && (
                                <span className="text-xs text-neutral-400">
                                    — pick specific questions on the next screen
                                </span>
                            )}
                        </div>
                    </RadioGroup>
                </div>

                <div className="flex w-full items-center justify-end gap-3">
                    <MyButton buttonType="secondary" scale="medium" onClick={resetSelectionConfig}>
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={handleConfirmSelection}
                        disable={!isCountValid || handleGetQuestionPaperData.status === 'pending'}
                    >
                        {handleGetQuestionPaperData.status === 'pending' ? (
                            'Loading…'
                        ) : selectionMode === 'manual' ? (
                            <>
                                Choose Questions
                                <ArrowRight size={14} className="ml-1.5" />
                            </>
                        ) : selectionMode === 'random' && count > 0 ? (
                            <>
                                <Shuffle size={14} className="mr-1.5" />
                                Add {count} Random Questions
                            </>
                        ) : (
                            <>
                                <Shuffle size={14} className="mr-1.5" />
                                Add All Questions
                            </>
                        )}
                    </MyButton>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-5 flex flex-col gap-5">
            {questionPaperList?.content?.map((questionsData, idx) => (
                <div
                    key={idx}
                    className={`flex flex-col gap-2 rounded-xl border-[1.5px] bg-neutral-50 p-4 ${
                        index !== undefined || isStudyLibraryAssignment ? 'cursor-pointer' : ''
                    }`}
                    onClick={
                        index !== undefined || isStudyLibraryAssignment
                            ? () => handleGetQuestionPaperDataById(questionsData)
                            : undefined
                    }
                >
                    <div className="flex items-center justify-between">
                        <h1 className="font-medium">{questionsData.title}</h1>
                        {!isAssessment && (
                            <div className="flex items-center gap-4">
                                <Star
                                    size={20}
                                    weight={questionsData.status === 'FAVOURITE' ? 'fill' : 'light'}
                                    onClick={() =>
                                        handleMarkFavourite(questionsData.id, questionsData.status)
                                    }
                                    className={`cursor-pointer ${
                                        questionsData.status === 'FAVOURITE'
                                            ? 'text-yellow-500'
                                            : 'text-gray-300'
                                    }`}
                                />
                                <DropdownMenu>
                                    <DropdownMenuTrigger>
                                        <Button
                                            variant="outline"
                                            className="h-6 bg-transparent p-1 shadow-none"
                                        >
                                            <DotsThree size={20} />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <ViewQuestionPaper
                                            questionPaperId={questionsData.id}
                                            title={questionsData.title}
                                            subject={questionsData.subject_id}
                                            level={questionsData.level_id}
                                            refetchData={refetchData}
                                            currentQuestionIndex={currentQuestionIndex}
                                            setCurrentQuestionIndex={setCurrentQuestionIndex}
                                            examType={examType}
                                        />
                                        <DropdownMenuItem
                                            onClick={() =>
                                                handleDeleteQuestionPaper(questionsData.id)
                                            }
                                            className="cursor-pointer"
                                        >
                                            Delete Question Paper
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <ExportQuestionPaper questionPaperId={questionsData.id} />
                            </div>
                        )}
                    </div>
                    <div className="flex w-full items-center justify-start gap-8 text-xs">
                        <p>
                            Created On:{' '}
                            {new Date(questionsData.created_on).toLocaleDateString() || 'N/A'}
                        </p>
                        <p>
                            Year/Class:{' '}
                            {instituteDetails &&
                                getLevelNameById(instituteDetails.levels, questionsData.level_id)}
                        </p>
                        <p>
                            Subject:{' '}
                            {instituteDetails && instituteDetails.subjects &&
                                getSubjectNameById(
                                    instituteDetails.subjects,
                                    questionsData.subject_id
                                )}
                        </p>
                    </div>
                </div>
            ))}
            <MyPagination
                currentPage={pageNo}
                totalPages={questionPaperList.total_pages}
                onPageChange={handlePageChange}
            />
        </div>
    );
};
