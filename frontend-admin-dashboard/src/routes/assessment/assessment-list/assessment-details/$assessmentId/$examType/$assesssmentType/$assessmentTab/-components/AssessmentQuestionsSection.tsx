import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle } from '@phosphor-icons/react';
import { Section } from '@/types/assessments/assessment-data-type';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Route } from '..';
import {
    getAssessmentDetails,
    getQuestionDataForSection,
} from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import {
    calculateTotalMarks,
    getQuestionTypeCounts,
} from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/helper';
import { calculateAverageMarks, calculateAveragePenalty } from '../-utils/helper';
import { QuestionData } from '@/types/assessments/assessment-steps';
import { useMemo, useState, useEffect } from 'react';
import TipTapEditor from '@/components/tiptap/TipTapEditor';
import { CriteriaPreviewDialog } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-components/StepComponents/-components/CriteriaPreviewDialog';
import {
    CriteriaJson,
    parseCriteria,
    CriteriaSource,
} from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/criteria-services';
import { CriteriaStatusBadge } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-components/StepComponents/-components/CriteriaStatusBadge';
import { AddEditCriteriaDialog } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-components/StepComponents/-components/AddEditCriteriaDialog';
import { toast } from 'sonner';

interface QuestionDuration {
    hrs: string;
    min: string;
}

interface Question {
    questionId: string;
    questionName: string;
    questionType: string;
    questionMark: string;
    questionPenalty: string;
    questionDuration: QuestionDuration;
    evaluation_criteria_json?: string | null;
    criteria_template_id?: string | null; // From API, indicates if from template
}

// Custom hook for data transformation
const useAdaptiveMarking = (questionsForSection: QuestionData[]) => {
    return useMemo(() => {
        return questionsForSection.map((questionData: QuestionData) => {
            const markingJson = questionData.marking_json
                ? JSON.parse(questionData.marking_json)
                : {};
            return {
                questionId: questionData.question_id || '',
                questionName: questionData.question?.content || '',
                questionType: questionData.question_type || '',
                questionMark: markingJson.data?.totalMark || '0',
                questionPenalty: markingJson.data?.negativeMark || '0',
                questionDuration: {
                    hrs:
                        typeof questionData.question_duration === 'number'
                            ? String(Math.floor(questionData.question_duration / 60))
                            : '0',
                    min:
                        typeof questionData.question_duration === 'number'
                            ? String(questionData.question_duration % 60)
                            : '0',
                },
                evaluation_criteria_json: questionData.evaluation_criteria_json || null,
                criteria_template_id: questionData.criteria_template_id || null,
            };
        });
    }, [questionsForSection]);
};

// Component for section info display
const SectionInfo = ({
    section,
    adaptiveMarking,
    examType,
    assessmentDetails,
}: {
    section: Section;
    adaptiveMarking: Question[];
    examType: string;
    assessmentDetails: any;
}) => {
    return (
        <>
            {section?.description?.content && (
                <div className="flex flex-col gap-2">
                    <h1>Section Description</h1>
                    <p
                        className="font-thin"
                        dangerouslySetInnerHTML={{
                            __html: section.description.content || '',
                        }}
                    />
                </div>
            )}
            {assessmentDetails[1]?.saved_data?.duration_distribution === 'SECTION' &&
                section.duration && (
                    <div className="flex flex-col justify-start gap-2 text-sm font-thin sm:flex-row sm:items-center sm:gap-8">
                        <h1 className="font-normal">Section Duration:</h1>
                        <div className="flex items-center gap-1">
                            <span>{section.duration}</span>
                            <span>minutes</span>
                        </div>
                    </div>
                )}
            {examType !== 'SURVEY' && (
                <div className="flex flex-col gap-2 text-sm font-thin sm:flex-row sm:items-start sm:gap-8">
                    <h1 className="font-normal">Marks Per Question (Default):</h1>
                    <span>{calculateAverageMarks(adaptiveMarking)}</span>
                </div>
            )}
            {examType !== 'SURVEY' && (
                <div className="flex flex-col gap-2 text-sm font-thin sm:flex-row sm:items-start sm:gap-8">
                    <h1 className="font-normal">Total Marks:</h1>
                    <span>{calculateTotalMarks(adaptiveMarking)}</span>
                </div>
            )}
            {calculateAveragePenalty(adaptiveMarking) > 0 && (
                <div className="flex w-1/2 items-center justify-between">
                    <div className="flex w-52 items-center justify-start gap-8">
                        <h1>Negative Marking:</h1>
                        <span className="font-thin">
                            {calculateAveragePenalty(adaptiveMarking)}
                        </span>
                    </div>
                    <CheckCircle size={22} weight="fill" className="text-success-600" />
                </div>
            )}
            {section.partial_marking && (
                <div className="flex w-1/2 items-center justify-between">
                    <h1>Partial Marking:</h1>
                    <CheckCircle size={22} weight="fill" className="text-success-600" />
                </div>
            )}
            {section.cutoff_marks > 0 && (
                <div className="flex w-1/2 items-center justify-between">
                    <div className="flex w-52 items-center justify-start gap-8">
                        <h1>Cutoff Marking:</h1>
                        <span className="font-thin">{section.cutoff_marks}</span>
                    </div>
                    <CheckCircle size={22} weight="fill" className="text-success-600" />
                </div>
            )}
            {section.problem_randomization && (
                <div className="flex w-1/2 items-center justify-between">
                    <h1>Problem Randomization:</h1>
                    <CheckCircle size={22} weight="fill" className="text-success-600" />
                </div>
            )}
        </>
    );
};

// Component for questions table
const QuestionsTable = ({
    adaptiveMarking,
    examType,
    assessmentDetails,
}: {
    adaptiveMarking: Question[];
    examType: string;
    assessmentDetails: any;
}) => {
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
    const [criteriaPreview, setCriteriaPreview] = useState<CriteriaJson | null>(null);
    const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);
    const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
    const [localAdaptiveMarking, setLocalAdaptiveMarking] = useState(adaptiveMarking);

    // Update local state when prop changes
    useEffect(() => {
        setLocalAdaptiveMarking(adaptiveMarking);
    }, [adaptiveMarking]);

    if (localAdaptiveMarking.length === 0) return null;

    const handlePreviewCriteria = (evaluation_criteria_json: string | null | undefined) => {
        if (!evaluation_criteria_json) return;

        const parsed = parseCriteria(evaluation_criteria_json);

        // Validate parsed criteria structure
        if (!parsed || !parsed.criteria || !Array.isArray(parsed.criteria)) {
            console.error('Invalid criteria structure:', parsed);
            toast.error('Unable to preview criteria. Invalid data format.');
            return;
        }

        setCriteriaPreview(parsed);
        setPreviewDialogOpen(true);
    };

    const handleEditCriteria = (questionIndex: number) => {
        setSelectedQuestionIndex(questionIndex);
        setCriteriaDialogOpen(true);
    };

    const handleSaveCriteria = (criteria: CriteriaJson | null, source: CriteriaSource) => {
        if (selectedQuestionIndex === null) return;

        const updated = [...localAdaptiveMarking];
        updated[selectedQuestionIndex] = {
            ...updated[selectedQuestionIndex]!,
            evaluation_criteria_json: criteria ? JSON.stringify(criteria) : null,
        } as Question;
        setLocalAdaptiveMarking(updated);
        setCriteriaDialogOpen(false);
    };

    const selectedQuestion =
        selectedQuestionIndex !== null ? localAdaptiveMarking[selectedQuestionIndex] : null;

    return (
        <div>
            <h1 className="mb-4 text-primary-500">
                {examType === 'SURVEY' ? 'Survey Questions' : 'Adaptive Marking Rules'}
            </h1>
            <div className="scrollbar-hide overflow-x-auto">
                <Table>
                    <TableHeader className="bg-primary-200">
                        <TableRow>
                            <TableHead>Q.No.</TableHead>
                            <TableHead>Question</TableHead>
                            <TableHead>Question Type</TableHead>
                            {examType !== 'SURVEY' && <TableHead>Marks</TableHead>}
                            {examType !== 'SURVEY' && <TableHead>Penalty</TableHead>}
                            {examType !== 'SURVEY' && <TableHead>Criteria</TableHead>}
                            {assessmentDetails[1]?.saved_data?.duration_distribution ===
                                'QUESTION' && <TableHead>Time</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="bg-neutral-50">
                        {localAdaptiveMarking.map((question: Question, index: number) => {
                            return (
                                <TableRow key={index}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                        <TipTapEditor
                                            value={question.questionName || ''}
                                            onChange={() => {}}
                                            editable={false}
                                        />
                                    </TableCell>
                                    <TableCell>{question.questionType}</TableCell>
                                    {examType !== 'SURVEY' && (
                                        <TableCell>{question.questionMark}</TableCell>
                                    )}
                                    {examType !== 'SURVEY' && (
                                        <TableCell>{question.questionPenalty}</TableCell>
                                    )}
                                    {examType !== 'SURVEY' && (
                                        <TableCell>
                                            {question.evaluation_criteria_json ? (
                                                <CriteriaStatusBadge
                                                    status={
                                                        question.criteria_template_id
                                                            ? 'template'
                                                            : 'manual'
                                                    }
                                                    onClick={() => handleEditCriteria(index)}
                                                    onPreview={() =>
                                                        handlePreviewCriteria(
                                                            question.evaluation_criteria_json
                                                        )
                                                    }
                                                />
                                            ) : (
                                                <span className="text-sm text-neutral-400">
                                                    Not set
                                                </span>
                                            )}
                                        </TableCell>
                                    )}
                                    {assessmentDetails[1]?.saved_data?.duration_distribution ===
                                        'QUESTION' && (
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {question.questionDuration.hrs}
                                                <span>:</span>
                                                {question.questionDuration.min}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Criteria Preview Dialog */}
            <CriteriaPreviewDialog
                criteria={criteriaPreview}
                open={previewDialogOpen}
                onClose={() => setPreviewDialogOpen(false)}
            />

            {/* Add/Edit Criteria Dialog */}
            {selectedQuestion && (
                <AddEditCriteriaDialog
                    question={{
                        id: selectedQuestion.questionId,
                        text: selectedQuestion.questionName,
                        question_type: selectedQuestion.questionType,
                        max_marks: parseFloat(selectedQuestion.questionMark) || 0,
                        subject: '', // Can be enhanced if subject data is available
                    }}
                    existingCriteria={
                        selectedQuestion.evaluation_criteria_json
                            ? (parseCriteria(selectedQuestion.evaluation_criteria_json) ?? undefined)
                            : undefined
                    }
                    open={criteriaDialogOpen}
                    onSave={handleSaveCriteria}
                    onClose={() => setCriteriaDialogOpen(false)}
                />
            )}
        </div>
    );
};

const AssessmentQuestionsSection = ({ section, index }: { section: Section; index: number }) => {
    const { assessmentId, examType } = Route.useParams();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const { data: assessmentDetails, isLoading: isAssessmentDetailsLoading } = useSuspenseQuery(
        getAssessmentDetails({
            assessmentId: assessmentId,
            instituteId: instituteDetails?.id,
            type: examType,
        })
    );
    const { data: questionsData, isLoading } = useSuspenseQuery(
        getQuestionDataForSection({ assessmentId, sectionIds: section.id })
    );

    const questionsForSection = questionsData[section.id] || [];
    const adaptiveMarking = useAdaptiveMarking(questionsForSection);

    if (isLoading || isAssessmentDetailsLoading) return <DashboardLoader />;

    return (
        <AccordionItem value={`section-${index}`} key={index}>
            <AccordionTrigger className="flex items-center justify-between">
                <div className="flex w-full items-center justify-between">
                    <div className="flex flex-col justify-start gap-1 text-primary-500 sm:flex-row sm:items-center sm:gap-2">
                        <h1 className="!ml-0 min-w-0 flex-shrink-0 border-none !pl-0 text-primary-500">
                            {section.name}
                        </h1>
                        <span className="text-sm font-thin !text-neutral-600">
                            (MCQ(Single Correct):&nbsp;
                            {getQuestionTypeCounts(adaptiveMarking).MCQS}
                            ,&nbsp; MCQ(Multiple Correct):&nbsp;
                            {getQuestionTypeCounts(adaptiveMarking).MCQM}
                            ,&nbsp; <span className="font-semibold">Total:&nbsp;</span>
                            {getQuestionTypeCounts(adaptiveMarking).totalQuestions})
                        </span>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-8">
                <SectionInfo
                    section={section}
                    adaptiveMarking={adaptiveMarking}
                    examType={examType}
                    assessmentDetails={assessmentDetails}
                />
                <QuestionsTable
                    adaptiveMarking={adaptiveMarking}
                    examType={examType}
                    assessmentDetails={assessmentDetails}
                />
                {adaptiveMarking.length > 0 && (
                    <div className="flex items-center justify-end gap-1">
                        <span>Total Marks</span>
                        <span>:</span>
                        <h1>{calculateTotalMarks(adaptiveMarking)}</h1>
                    </div>
                )}
            </AccordionContent>
        </AccordionItem>
    );
};

export default AssessmentQuestionsSection;
