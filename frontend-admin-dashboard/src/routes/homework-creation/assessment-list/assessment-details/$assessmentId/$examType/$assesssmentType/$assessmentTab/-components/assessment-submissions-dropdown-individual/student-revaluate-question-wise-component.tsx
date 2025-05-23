import { DialogContent } from "@/components/ui/dialog";
import { AssessmentRevaluateStudentInterface } from "@/types/assessments/assessment-overview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { getInstituteId } from "@/constants/helper";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { getAssessmentDetails } from "@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services";
import { Route } from "../..";
import {
    getRevaluateStudentResult,
    handleGetQuestionInsightsData,
} from "../../-services/assessment-details-services";
import {
    transformQuestionInsightsQuestionsData,
    transformQuestionsDataToRevaluateAPI,
} from "../../-utils/helper";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { MyButton } from "@/components/design-system/button";
import {
    AssessmentRevaluateQuestionWiseInterface,
    SelectedFilterRevaluateInterface,
} from "@/types/assessments/assessment-revaluate-question-wise";
import { toast } from "sonner";

export function StudentRevaluateQuestionWiseComponent({
    student,
    onClose,
}: {
    student: AssessmentRevaluateStudentInterface;
    onClose: () => void;
}) {
    const instituteId = getInstituteId();
    const [selectedFilter] = useState<SelectedFilterRevaluateInterface>({
        questions: [
            {
                section_id: "",
                question_ids: [],
            },
        ],
        attempt_ids: [],
    });
    const { assessmentId, examType } = Route.useParams();

    const { data: assessmentDetails } = useSuspenseQuery(
        getAssessmentDetails({ assessmentId, instituteId, type: examType }),
    );

    const sectionsInfo = assessmentDetails[1]?.saved_data.sections?.map((section) => ({
        name: section.name,
        id: section.id,
    }));

    const [selectedSection, setSelectedSection] = useState(sectionsInfo ? sectionsInfo[0]?.id : "");

    const { data } = useSuspenseQuery(
        handleGetQuestionInsightsData({ instituteId, assessmentId, sectionId: selectedSection }),
    );

    const [selectedSectionData, setSelectedSectionData] = useState(
        transformQuestionInsightsQuestionsData(data?.question_insight_dto),
    );

    // Maintain selected questions state
    const [selectedQuestions, setSelectedQuestions] = useState<{ [key: string]: string[] }>({});

    // Handle checkbox selection
    const handleCheckboxChange = (questionId: string, sectionId: string) => {
        setSelectedQuestions((prev) => {
            const sectionQuestions = prev[sectionId] || [];
            const updatedQuestions = sectionQuestions.includes(questionId)
                ? sectionQuestions.filter((id) => id !== questionId) // Uncheck: Remove question
                : [...sectionQuestions, questionId]; // Check: Add question

            return { ...prev, [sectionId]: updatedQuestions };
        });
    };
    const handleSelectAllForSection = (
        sectionId: string,
        questions: AssessmentRevaluateQuestionWiseInterface[],
    ) => {
        setSelectedQuestions((prev) => {
            const isAllSelected = prev[sectionId]?.length === questions.length;

            return {
                ...prev,
                [sectionId]: isAllSelected
                    ? []
                    : questions
                          .map((q) => q.assessment_question_preview_dto.questionId)
                          .filter((id): id is string => Boolean(id)), // Ensures no `undefined` values
            };
        });
    };

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
                "Your attempt for this assessment has been revaluated. Please check your email!",
                {
                    className: "success-toast",
                    duration: 4000,
                },
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
            methodType: "PARTICIPANTS_AND_QUESTIONS",
            selectedFilter: {
                ...selectedFilter,
                questions: transformQuestionsDataToRevaluateAPI(selectedQuestions),
                attempt_ids: [student.attempt_id],
            },
        });
    };

    useEffect(() => {
        setSelectedSectionData(transformQuestionInsightsQuestionsData(data?.question_insight_dto));
    }, [selectedSection]);
    return (
        <>
            <DialogContent className="no-scrollbar !m-0 flex h-[90vh] !w-full !max-w-[90vw] flex-col !gap-0 overflow-y-auto !p-0">
                <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">
                    Question Wise Revaluation
                </h1>
                <Tabs value={selectedSection} onValueChange={setSelectedSection} className="px-8">
                    <div className="sticky top-0 flex items-center justify-between">
                        <TabsList className="mb-2 mt-6 inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
                            {sectionsInfo?.map((section) => (
                                <TabsTrigger
                                    key={section.id}
                                    value={section.id}
                                    className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                                        selectedSection === section.id
                                            ? "rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50"
                                            : "border-none bg-transparent"
                                    }`}
                                >
                                    <span
                                        className={
                                            selectedSection === section.id ? "text-primary-500" : ""
                                        }
                                    >
                                        {section.name}
                                    </span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                    <TabsContent
                        value={selectedSection || ""}
                        className="max-h-[calc(100vh-120px)] overflow-y-auto"
                    >
                        <Table>
                            <TableHeader className="bg-primary-200">
                                <TableRow>
                                    <TableHead>Q.No.</TableHead>
                                    <TableHead>Question</TableHead>
                                    <TableHead>
                                        <Checkbox
                                            checked={
                                                selectedQuestions[selectedSection!]?.length ===
                                                    selectedSectionData.length &&
                                                selectedSectionData.length > 0
                                            }
                                            onCheckedChange={() =>
                                                handleSelectAllForSection(
                                                    selectedSection!,
                                                    selectedSectionData,
                                                )
                                            }
                                        />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="bg-neutral-50">
                                {selectedSectionData.map((question, index) => (
                                    <TableRow
                                        key={question.assessment_question_preview_dto.questionId}
                                    >
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell
                                            dangerouslySetInnerHTML={{
                                                __html:
                                                    question.assessment_question_preview_dto
                                                        .questionName || "",
                                            }}
                                        />
                                        <TableCell>
                                            <Checkbox
                                                checked={
                                                    selectedQuestions[selectedSection!]?.includes(
                                                        question.assessment_question_preview_dto
                                                            .questionId ?? "",
                                                    ) || false
                                                }
                                                onCheckedChange={() =>
                                                    handleCheckboxChange(
                                                        question.assessment_question_preview_dto
                                                            .questionId ?? "",
                                                        selectedSection!,
                                                    )
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TabsContent>
                </Tabs>
                <div className="p-8 text-right">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        onClick={handleRevaluateStudent}
                    >
                        Revaluate
                    </MyButton>
                </div>
            </DialogContent>
        </>
    );
}
