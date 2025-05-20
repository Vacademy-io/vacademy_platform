import React, { useRef } from "react";
import { z } from "zod";
import sectionDetailsSchema from "../-utils/section-details-sechma";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { MyButton } from "@/components/design-system/button";
import { Separator } from "@/components/ui/separator";
import { Plus } from "phosphor-react";
import { Accordion } from "@/components/ui/accordion";
import { StepContentProps } from "@/types/assessments/step-content-props";
import { zodResolver } from "@hookform/resolvers/zod";
import Step2SectionInfo from "./Step2SectionInfo";
import { toast } from "sonner";
import axios from "axios";
import { transformFormData } from "../-utils/transformFormData";
import { ADD_QUESTIONS_URL } from "@/constants/urls";
import { useSavedAssessmentStore } from "@/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/global-states";
import { useNavigate } from "@tanstack/react-router";

type SectionFormType = z.infer<typeof sectionDetailsSchema>;

const Step2AddingQuestions: React.FC<StepContentProps> = ({
    currentStep,
    handleCompleteCurrentStep,
}) => {
    // const storeDataStep2 = useSectionDetailsStore((state) => state);
    const navigate = useNavigate();
    const { savedAssessmentId, saveAssessmentName, setSavedAssessmentId, setSavedAssessmentName } =
        useSavedAssessmentStore();
    const form = useForm<SectionFormType>({
        resolver: zodResolver(sectionDetailsSchema),
        defaultValues: {
            status: "INCOMPLETE",
            section: [
                {
                    sectionId: "",
                    sectionName: `Section 1`,
                    questionPaperTitle: "",
                    subject: "",
                    yearClass: "",
                    uploaded_question_paper: null,
                    question_duration: {
                        hrs: "0",
                        min: "0",
                    },
                    section_description: "",
                    section_duration: {
                        hrs: "0",
                        min: "0",
                    },
                    marks_per_question: "0",
                    total_marks: "0",
                    negative_marking: {
                        checked: false,
                        value: "0",
                    },
                    partial_marking: false,
                    cutoff_marks: {
                        checked: false,
                        value: "0",
                    },
                    problem_randomization: false,
                    adaptive_marking_for_each_question: [],
                },
            ],
        },
        mode: "onChange",
    });

    const { handleSubmit, getValues, control } = form;
    // Store initial data in useRef to ensure it remains constant throughout the form updates
    const oldData = useRef(getValues());
    const allSections = getValues("section");

    const onSubmit = async (data: z.infer<typeof sectionDetailsSchema>) => {
        try {
            const response = await axios({
                method: "POST",
                url: ADD_QUESTIONS_URL,
                data: transformFormData(data),
                params: {
                    assessmentId: savedAssessmentId,
                },
            });
            if (response.status === 200) {
                const existingAssessments = JSON.parse(localStorage.getItem("assessments") || "[]");
                // Add new student
                existingAssessments.push({
                    assessmentId: savedAssessmentId,
                    title: saveAssessmentName,
                });

                localStorage.setItem("assessments", JSON.stringify(existingAssessments));

                setSavedAssessmentId("");
                setSavedAssessmentName("");
                toast.success("Your assessment has been saved successfully!", {
                    className: "success-toast",
                    duration: 2000,
                });
                handleCompleteCurrentStep();
                navigate({
                    to: "/evaluator-ai/assessment",
                });
            }
        } catch (error) {
            toast.error("Error saving assessment", {
                className: "error-toast",
                duration: 2000,
            });
            console.error("Error saving assessment:", error);
        }
        console.log(oldData.current);
    };

    const onInvalid = (err: unknown) => {
        console.log(err);
    };

    const { append } = useFieldArray({
        control,
        name: "section", // Matches the key in defaultValues
    });

    const handleAddSection = () => {
        append({
            sectionId: "",
            sectionName: `Section ${allSections.length + 1}`,
            questionPaperTitle: "",
            subject: "",
            yearClass: "",
            uploaded_question_paper: null,
            question_duration: {
                hrs: "0",
                min: "0",
            },
            section_description: "",
            section_duration: {
                hrs: "0",
                min: "0",
            },
            marks_per_question: "0",
            total_marks: "0",
            negative_marking: {
                checked: false,
                value: "0",
            },
            partial_marking: false,
            cutoff_marks: {
                checked: false,
                value: "0",
            },
            problem_randomization: false,
            adaptive_marking_for_each_question: [],
        });
    };

    return (
        <FormProvider {...form}>
            <form>
                {allSections.length > 0 && (
                    <>
                        <div className="m-0 flex items-center justify-between p-0">
                            <h1>Add Questions</h1>
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="primary"
                                onClick={handleSubmit(onSubmit, onInvalid)}
                            >
                                {"Next"}
                            </MyButton>
                        </div>

                        <Separator className="my-4" />
                        <Accordion type="single" collapsible defaultValue={`section-0`}>
                            {allSections.map((_, index) => (
                                <Step2SectionInfo
                                    key={index}
                                    form={form}
                                    index={index}
                                    currentStep={currentStep}
                                    oldData={oldData}
                                />
                            ))}
                        </Accordion>
                    </>
                )}
                <MyButton
                    type="button"
                    scale="large"
                    buttonType="secondary"
                    id="add-section"
                    className={`${allSections.length > 0 ? "mt-8" : ""} font-thin`}
                    onClick={handleAddSection}
                >
                    <Plus size={32} />
                    Add Section
                </MyButton>
            </form>
        </FormProvider>
    );
};

export default Step2AddingQuestions;
