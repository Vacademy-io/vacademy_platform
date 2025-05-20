import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DotOutline } from '@phosphor-icons/react';
import { Separator } from '@radix-ui/react-separator';
import { getSubjectNameById } from '@/routes/assessment/question-papers/-utils/helper';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { convertToLocalDateTime, extractDateTime } from '@/constants/helper';
import { ResponseBreakdownComponent } from './response-breakdown-component';
import { MarksBreakdownComponent } from './marks-breakdown-component';
import { Crown } from '@/svgs';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusChips } from '@/components/design-system/chips';
import { parseHtmlToString } from '@/components/common/export-offline/utils/utils';
import { AssessmentReportStudentInterface } from '@/types/assessments/assessment-overview';
import { AssessmentTestReport } from '@/types/assessments/assessment-data-report';
import { Clock } from 'phosphor-react';
import ExportDialogPDFCSV from '@/components/common/export-dialog-pdf-csv';
import { toast } from 'sonner';
import { handleGetStudentReportExportPDF } from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-services/assessment-details-services';
import { Steps } from '@/types/assessments/assessment-data-type';

interface TestReportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    testReport: AssessmentTestReport;
    studentReport: AssessmentReportStudentInterface;
    assessmentDetails: Steps;
}

export const TestReportDialog = ({
    isOpen,
    onClose,
    testReport,
    studentReport,
    assessmentDetails,
}: TestReportDialogProps) => {
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const sectionsInfo = assessmentDetails[1]?.saved_data.sections?.map((section) => ({
        name: section.name,
        id: section.id,
    }));

    const [selectedSection, setSelectedSection] = useState(sectionsInfo ? sectionsInfo[0]?.id : '');

    const currentSectionAllQuestions = testReport.all_sections[selectedSection!];

    const responseData = {
        attempted:
            testReport.question_overall_detail_dto.correctAttempt +
            testReport.question_overall_detail_dto.partialCorrectAttempt +
            testReport.question_overall_detail_dto.wrongAttempt,
        skipped: testReport.question_overall_detail_dto.skippedCount,
    };
    const marksData = {
        correct: testReport.question_overall_detail_dto.correctAttempt,
        partiallyCorrect: testReport.question_overall_detail_dto.partialCorrectAttempt,
        wrongResponse: testReport.question_overall_detail_dto.wrongAttempt,
        skipped: testReport.question_overall_detail_dto.skippedCount,
    };
    const getExportStudentReportDataPDF = useMutation({
        mutationFn: ({
            assessmentId,
            instituteId,
            attemptId,
        }: {
            assessmentId: string;
            instituteId: string | undefined;
            attemptId: string;
        }) => handleGetStudentReportExportPDF(assessmentId, instituteId, attemptId),
        onSuccess: async (response) => {
            const date = new Date();
            const url = window.URL.createObjectURL(new Blob([response]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `pdf_student_report_${date.toLocaleString()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Test report data for PDF exported successfully!');
        },
        onError: (error: unknown) => {
            throw error;
        },
    });
    const handleExportPDF = () => {
        getExportStudentReportDataPDF.mutate({
            assessmentId: studentReport.assessment_id,
            instituteId: instituteDetails?.id,
            attemptId: studentReport.assessment_id,
        });
    };
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="no-scrollbar !m-0 flex h-[90vh] !w-full !max-w-[90vw] flex-col !gap-0 overflow-y-auto !p-0">
                <DialogHeader className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="w-full bg-primary-50 px-6 py-4 text-h3 font-semibold text-primary-500">
                            Student Test Report
                        </DialogTitle>
                    </div>
                </DialogHeader>

                {/* Test Info Section */}

                <div className="flex flex-col gap-10 p-6">
                    <div className="flex justify-between">
                        <div className="flex flex-col gap-4">
                            <div className="text-h2 font-semibold">
                                {studentReport.assessment_name}
                            </div>
                        </div>
                        <ExportDialogPDFCSV
                            handleExportPDF={handleExportPDF}
                            isPDFLoading={
                                getExportStudentReportDataPDF.status === 'pending' ? true : false
                            }
                            isEnablePDF={true}
                            isEnableCSV={false}
                        />
                    </div>

                    <div className="grid grid-cols-3 text-body">
                        <div>
                            Subject:{' '}
                            {getSubjectNameById(
                                instituteDetails?.subjects || [],
                                testReport.question_overall_detail_dto.subjectId
                            ) || ''}
                        </div>
                        <div>
                            Attempt Date:{' '}
                            {
                                extractDateTime(
                                    convertToLocalDateTime(
                                        testReport.question_overall_detail_dto.startTime
                                    )
                                ).date
                            }
                        </div>
                        <div>
                            Marks: {testReport.question_overall_detail_dto.achievedMarks.toFixed(2)}
                        </div>
                        <div>
                            Completion Time:{' '}
                            {(
                                testReport.question_overall_detail_dto.completionTimeInSeconds / 60
                            ).toFixed(2)}{' '}
                            min
                        </div>
                        <div>
                            Start Time:{' '}
                            {
                                extractDateTime(
                                    convertToLocalDateTime(
                                        testReport.question_overall_detail_dto.startTime
                                    )
                                ).time
                            }
                        </div>
                        <div>
                            End Time:{' '}
                            {
                                extractDateTime(
                                    convertToLocalDateTime(
                                        testReport.question_overall_detail_dto.submitTime
                                    )
                                ).time
                            }
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Charts Section */}
                <div className="p-6 text-h3 font-semibold text-primary-500">Score Report</div>
                <div className="flex">
                    <div className="ml-6 flex flex-col items-center gap-20 p-6">
                        <div className="flex flex-col">
                            <h1>Rank</h1>
                            <div className="flex items-center gap-1">
                                {testReport.question_overall_detail_dto.rank === 1 && (
                                    <Crown className="size-6" />
                                )}
                                <p className="text-neutral-500">
                                    {testReport.question_overall_detail_dto.rank}
                                </p>
                            </div>
                        </div>
                        <div>
                            <h1>Percentile</h1>
                            <p className="text-center text-neutral-500">
                                {testReport.question_overall_detail_dto.percentile.toFixed(2)}%
                            </p>
                        </div>
                        <div>
                            <h1>Marks</h1>
                            <p className="text-neutral-500">
                                {studentReport.total_marks.toFixed(2)}/20
                            </p>
                        </div>
                    </div>
                    <div className="flex w-full flex-col items-center gap-6">
                        <div className="text-h3 font-semibold">Response Breakdown</div>
                        <ResponseBreakdownComponent responseData={responseData} />
                        <div className="flex flex-col">
                            <div className="-mt-14 flex items-center">
                                <DotOutline weight="fill" className="size-20 text-success-400" />
                                <p className="-ml-4 text-[14px]">
                                    Attempted: &nbsp;{responseData.attempted}
                                </p>
                            </div>
                            <div className="-mt-12 flex items-center">
                                <DotOutline weight="fill" className="size-20 text-neutral-200" />
                                <p className="-ml-4 text-[14px]">
                                    Skipped: &nbsp;{responseData.skipped}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex w-full flex-col items-center gap-6">
                        <div className="text-h3 font-semibold">Marks Breakdown</div>
                        <MarksBreakdownComponent marksData={marksData} />
                        <div className="flex flex-col">
                            <div className="-mb-8 flex items-center justify-between">
                                <div className="flex items-center">
                                    <DotOutline
                                        size={70}
                                        weight="fill"
                                        className="text-success-400"
                                    />
                                    <p>Correct Respondents: </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p>{marksData.correct}</p>
                                    <p>
                                        {testReport.question_overall_detail_dto.totalCorrectMarks >
                                        0
                                            ? `(+${testReport.question_overall_detail_dto.totalCorrectMarks.toFixed(
                                                  2
                                              )})`
                                            : `(${testReport.question_overall_detail_dto.totalCorrectMarks.toFixed(
                                                  2
                                              )})`}
                                    </p>
                                </div>
                            </div>
                            <div className="-mb-8 flex items-center justify-between gap-4">
                                <div className="flex items-center">
                                    <DotOutline
                                        size={70}
                                        weight="fill"
                                        className="text-warning-400"
                                    />
                                    <p>Partially Correct Respondents: </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p>{marksData.partiallyCorrect}</p>
                                    <p>
                                        {testReport.question_overall_detail_dto.totalPartialMarks >
                                        0
                                            ? `(+${testReport.question_overall_detail_dto.totalPartialMarks.toFixed(
                                                  2
                                              )})`
                                            : `(${testReport.question_overall_detail_dto.totalPartialMarks.toFixed(
                                                  2
                                              )})`}
                                    </p>
                                </div>
                            </div>
                            <div className="-mb-8 flex items-center justify-between">
                                <div className="flex items-center">
                                    <DotOutline
                                        size={70}
                                        weight="fill"
                                        className="text-danger-400"
                                    />
                                    <p>Wrong Respondents: </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p>{marksData.wrongResponse}</p>
                                    <p>
                                        {testReport.question_overall_detail_dto
                                            .totalIncorrectMarks > 0
                                            ? `(+${testReport.question_overall_detail_dto.totalIncorrectMarks.toFixed(
                                                  2
                                              )})`
                                            : `(${testReport.question_overall_detail_dto.totalIncorrectMarks.toFixed(
                                                  2
                                              )})`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <DotOutline
                                        size={70}
                                        weight="fill"
                                        className="text-neutral-200"
                                    />
                                    <p>Skipped: </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p>{marksData.skipped}</p>
                                    <p>(0)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <Separator />

                <Tabs value={selectedSection} onValueChange={setSelectedSection} className="px-8">
                    <div className="sticky top-0 flex items-center justify-between">
                        <TabsList className="mb-2 mt-6 inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
                            {sectionsInfo?.map((section) => (
                                <TabsTrigger
                                    key={section.id}
                                    value={section.id}
                                    className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                                        selectedSection === section.id
                                            ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                            : 'border-none bg-transparent'
                                    }`}
                                >
                                    <span
                                        className={`${
                                            selectedSection === section.id ? 'text-primary-500' : ''
                                        }`}
                                    >
                                        {section.name}
                                    </span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                </Tabs>

                {/* Answer Review Section */}
                <div className="flex w-full flex-col gap-10 p-6">
                    <div className="text-h3 font-semibold text-primary-500">Answer Review</div>
                    <div className="flex w-full flex-col gap-10">
                        {currentSectionAllQuestions && currentSectionAllQuestions.length > 0 ? (
                            currentSectionAllQuestions.map((review, index) => (
                                <div className="flex w-full flex-col gap-10" key={index}>
                                    <div className="flex w-full flex-col gap-4">
                                        <div className="flex w-full items-start justify-between gap-6 text-subtitle">
                                            <div className="flex items-start gap-6 text-title">
                                                <div className="whitespace-nowrap">
                                                    Question ({index + 1}.)
                                                </div>
                                                <div>{parseHtmlToString(review.question_name)}</div>
                                            </div>
                                            <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                                                <Clock size={20} />
                                                <p className="text-primary-500">
                                                    {review.time_taken_in_seconds} sec
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex w-full items-center gap-6 text-subtitle">
                                            <div>Student answer:</div>
                                            <div className="flex w-full items-center justify-between">
                                                <div
                                                    className={`flex w-[644px] items-center rounded-lg p-4 ${
                                                        review.answer_status == 'CORRECT'
                                                            ? 'bg-success-50'
                                                            : review.answer_status == 'INCORRECT'
                                                              ? 'bg-danger-100'
                                                              : 'bg-neutral-50'
                                                    }`}
                                                >
                                                    <div>
                                                        {review.student_response_options &&
                                                        review.student_response_options.length >
                                                            0 ? (
                                                            review.student_response_options.map(
                                                                (option, idx) => {
                                                                    return (
                                                                        <p key={idx}>
                                                                            {parseHtmlToString(
                                                                                option.option_name
                                                                            )}
                                                                        </p>
                                                                    );
                                                                }
                                                            )
                                                        ) : (
                                                            <p>No response</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <StatusChips
                                                    status={
                                                        review.answer_status == 'CORRECT'
                                                            ? 'active'
                                                            : review.answer_status == 'INCORRECT'
                                                              ? 'error'
                                                              : 'inactive'
                                                    }
                                                    showIcon={false}
                                                >
                                                    {review.mark.toFixed(2)} Marks
                                                </StatusChips>
                                                <StatusChips
                                                    status={
                                                        review.answer_status == 'CORRECT'
                                                            ? 'active'
                                                            : review.answer_status == 'INCORRECT'
                                                              ? 'error'
                                                              : 'inactive'
                                                    }
                                                    className="rounded-full"
                                                >
                                                    <></>
                                                </StatusChips>
                                            </div>
                                        </div>
                                        {review.answer_status !== 'CORRECT' && (
                                            <div className="flex w-full items-center gap-6 text-subtitle">
                                                <div>Correct answer:</div>
                                                <div className="flex w-full items-center justify-between">
                                                    <div
                                                        className={`flex w-[644px] rounded-lg bg-success-50 p-4`}
                                                    >
                                                        <div>
                                                            {review.correct_options ? (
                                                                review.correct_options.map(
                                                                    (option, idx) => {
                                                                        return (
                                                                            <p key={idx}>
                                                                                {parseHtmlToString(
                                                                                    option.option_name
                                                                                )}
                                                                            </p>
                                                                        );
                                                                    }
                                                                )
                                                            ) : (
                                                                <p>No response</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {review.explanation && (
                                            <div className="flex items-center gap-6 text-subtitle">
                                                <div>Explanation:</div>
                                                <div>{parseHtmlToString(review.explanation)}</div>
                                            </div>
                                        )}
                                    </div>
                                    <Separator />
                                </div>
                            ))
                        ) : (
                            <div className="py-4 text-center text-subtitle">
                                No answer review available
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
