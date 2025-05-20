"use client";

import axios from "axios";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutContainer } from "../-components/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect, useState } from "react";
import { MyButton } from "@/components/design-system/button";
import { Examination } from "@/svgs";
import { useNavigate } from "@tanstack/react-router";
import { CalendarBlank } from "phosphor-react";
import { EVALUATION_TOOL_GET_QUESTION } from "@/constants/urls";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
// import { MarkingCriteriaDialog } from "./create-assessment/-components/marking-criteria-dialog";
import EditCriteriaDialog from "./create-assessment/-components/edit-criteria-dialog";
import { useMutation } from "@tanstack/react-query";
import { handleUpdateCriteria } from "./create-assessment/-services/assessment-services";
import { SectionResponse } from "./create-assessment/-hooks/getQuestionsDataForSection";
import { Loader2 } from "lucide-react";

interface Assessment {
    assessmentId: string;
    title: string;
}

interface Question {
    id: string;
    question_text: {
        content: string;
    };
    question_type: string;
    evaluation_type: string;
    explanation: {
        content: string;
    };
    marking_json: string;
    question_order: number;
}

interface AssessmentDetails {
    basic_details: {
        test_creation: {
            assessment_name: string;
        };
    };
    sections: Array<{
        id: string;
        name: string;
        questions: Question[];
    }>;
}

export const Route = createFileRoute("/evaluator-ai/assessment/")({
    component: () => (
        <LayoutContainer>
            <RouteComponent />
        </LayoutContainer>
    ),
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();
    const navigate = useNavigate();
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [assessmentDetails, setAssessmentDetails] = useState<
        Record<string, AssessmentDetails | null>
    >({});
    const [loadingAssessments, setLoadingAssessments] = useState<Record<string, boolean>>({});

    const updateCriteriaMutation = useMutation({
        mutationFn: ({
            assessmentId,
            sectionDetails,
        }: {
            assessmentId: string;
            sectionDetails: SectionResponse[];
        }) => handleUpdateCriteria({ assessmentId, sectionDetails }),

        onSuccess: () => {},
        onError: () => {},
    });

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Assessment</h1>);
        const storedData = localStorage.getItem("assessments");
        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                setAssessments(parsed);
                console.log("Parsed assessment:", parsed);
            } catch (err) {
                console.error("Error parsing assessment:", err);
            }
        }
    }, []);

    const fetchAssessmentDetails = async (assessmentId: string) => {
        if (assessmentDetails[assessmentId]) return;

        setLoadingAssessments((prev) => ({ ...prev, [assessmentId]: true }));

        try {
            const response = await axios.get(`${EVALUATION_TOOL_GET_QUESTION}/${assessmentId}`);
            console.log("Fetched questions for assessment:", assessmentId, response.data);
            setAssessmentDetails((prev) => ({
                ...prev,
                [assessmentId]: response.data,
            }));
        } catch {
            console.error("Error fetching assessment details:");
        } finally {
            setLoadingAssessments((prev) => ({ ...prev, [assessmentId]: false }));
        }
    };

    return (
        <main className="flex min-h-screen scroll-mt-10 flex-col">
            <div className="mt-4">
                {assessments.length > 0 ? (
                    <div className="flex flex-col space-y-5">
                        <div className="flex w-full items-center justify-between">
                            <h1 className="text-xl font-semibold">Assessment List</h1>
                            <MyButton
                                scale="large"
                                buttonType="primary"
                                layoutVariant="default"
                                className="ml-auto"
                                onClick={() =>
                                    navigate({ to: "/evaluator-ai/assessment/create-assessment" })
                                }
                            >
                                <CalendarBlank size={32} />
                                Create Assessment
                            </MyButton>
                        </div>

                        <Accordion type="single" collapsible className="w-full">
                            {assessments.map((assessment) => (
                                <AccordionItem
                                    key={assessment.assessmentId}
                                    value={assessment.assessmentId}
                                    className="mb-4 rounded-md border bg-white shadow-sm transition hover:shadow-md"
                                >
                                    <AccordionTrigger
                                        className="px-4 py-2"
                                        onClick={() =>
                                            fetchAssessmentDetails(assessment.assessmentId)
                                        }
                                    >
                                        <div className="flex flex-col items-start text-left">
                                            <h3 className="text-base font-semibold text-gray-800">
                                                {assessment.title}
                                            </h3>
                                            <span className="text-xs text-gray-500">
                                                Assessment ID: {assessment.assessmentId}
                                            </span>
                                        </div>
                                    </AccordionTrigger>

                                    <AccordionContent className="px-4">
                                        {loadingAssessments[assessment.assessmentId] ? (
                                            <div className="py-4 text-center">
                                                <Loader2 className="mx-auto size-6 animate-spin" />
                                                <p className="mt-2 text-sm text-gray-500">
                                                    Loading assessment details...
                                                </p>
                                            </div>
                                        ) : assessmentDetails[assessment.assessmentId] ? (
                                            <div className="py-2">
                                                {assessmentDetails[
                                                    assessment.assessmentId
                                                ]?.sections.map((section) => (
                                                    <div
                                                        key={section.id}
                                                        className="mb-4 rounded-md border p-3"
                                                    >
                                                        <h4 className="mb-2 font-medium">
                                                            {section.name}
                                                        </h4>

                                                        <div className="space-y-1">
                                                            <div className="mb-2 grid grid-cols-6 text-sm font-medium text-muted-foreground">
                                                                <div className="col-span-3">
                                                                    Question
                                                                </div>
                                                                <div className="col-span-2">
                                                                    Answer
                                                                </div>
                                                                <div className="col-span-1">
                                                                    Criteria
                                                                </div>
                                                            </div>

                                                            {section.questions.map((question) => (
                                                                <div
                                                                    key={question.id}
                                                                    className="grid grid-cols-6 items-start gap-x-2 border-t py-2"
                                                                >
                                                                    <div
                                                                        className="col-span-3 text-sm"
                                                                        dangerouslySetInnerHTML={{
                                                                            __html: question
                                                                                .question_text
                                                                                .content,
                                                                        }}
                                                                    />
                                                                    <ExplanationPreview
                                                                        explanation={
                                                                            question.explanation
                                                                                .content
                                                                        }
                                                                    />
                                                                    <div className="col-span-1 flex gap-2">
                                                                        {/* <MarkingCriteriaDialog
                                                                            markingJson={
                                                                                question.marking_json
                                                                            }
                                                                        /> */}
                                                                        <EditCriteriaDialog
                                                                            markingJson={
                                                                                question.marking_json
                                                                            }
                                                                            onSave={(updated) => {
                                                                                const sectionData =
                                                                                    assessmentDetails[
                                                                                        assessment
                                                                                            .assessmentId
                                                                                    ]?.sections;
                                                                                // Create a new array with updated marking_json for the correct question
                                                                                const updatedSections =
                                                                                    sectionData?.map(
                                                                                        (
                                                                                            section,
                                                                                        ) => ({
                                                                                            ...section,
                                                                                            new_section:
                                                                                                false,
                                                                                            questions:
                                                                                                section.questions.map(
                                                                                                    (
                                                                                                        q,
                                                                                                    ) =>
                                                                                                        q.id ===
                                                                                                        question.id
                                                                                                            ? {
                                                                                                                  ...q,
                                                                                                                  marking_json:
                                                                                                                      updated,
                                                                                                                  new_question:
                                                                                                                      false,
                                                                                                              }
                                                                                                            : {
                                                                                                                  ...q,
                                                                                                                  new_question:
                                                                                                                      false,
                                                                                                              },
                                                                                                ),
                                                                                        }),
                                                                                    );

                                                                                updateCriteriaMutation.mutate(
                                                                                    {
                                                                                        assessmentId:
                                                                                            assessment.assessmentId,
                                                                                        sectionDetails:
                                                                                            updatedSections as SectionResponse[],
                                                                                    },
                                                                                );
                                                                                console.log(
                                                                                    "Updated marking json:",
                                                                                    updated,
                                                                                );
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}

                                                <div className="mt-4 flex justify-between border-t pt-2">
                                                    <button
                                                        className="rounded-md bg-red-500 px-3 py-1.5 text-sm text-white"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (
                                                                confirm(
                                                                    "Are you sure you want to delete this assessment? ",
                                                                )
                                                            ) {
                                                                const updatedAssessments =
                                                                    assessments.filter(
                                                                        (a) =>
                                                                            a.assessmentId !==
                                                                            assessment.assessmentId,
                                                                    );
                                                                setAssessments(updatedAssessments);
                                                                localStorage.setItem(
                                                                    "assessments",
                                                                    JSON.stringify(
                                                                        updatedAssessments,
                                                                    ),
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="py-4 text-center text-gray-500">
                                                Failed to load assessment details
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                ) : (
                    <div className="py-10 text-center text-gray-500">
                        <Examination className="mx-auto mb-4 size-40 text-gray-400" />
                        <p className="mb-2">No assessments available</p>
                        <MyButton
                            scale="large"
                            buttonType="primary"
                            layoutVariant="default"
                            className="mx-auto"
                            onClick={() =>
                                navigate({ to: "/evaluator-ai/assessment/create-assessment" })
                            }
                        >
                            <CalendarBlank size={32} />
                            Create Assessment
                        </MyButton>
                    </div>
                )}
            </div>
        </main>
    );
}

function ExplanationPreview({ explanation }: { explanation: string }) {
    const [expanded, setExpanded] = useState(false);

    const explanationHtml = explanation || "No answer available";
    const plainText = explanationHtml.replace(/<[^>]+>/g, "").trim();
    const words = plainText.split(/\s+/);
    const preview = words.slice(0, 10).join(" ");
    const hasMore = words.length > 10;

    return (
        <div className="col-span-2 text-sm">
            <span>{expanded ? plainText : preview}</span>
            {hasMore && (
                <>
                    {" "}
                    <button
                        className="text-primary-500 underline"
                        onClick={() => {
                            setExpanded((prev) => !prev);
                        }}
                    >
                        {expanded ? "View Less" : "View More"}
                    </button>
                </>
            )}
        </div>
    );
}
