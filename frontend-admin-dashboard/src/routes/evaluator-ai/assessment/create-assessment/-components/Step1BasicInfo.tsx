import { StepContentProps } from "@/types/assessments/step-content-props";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { BasicInfoFormSchema } from "../-utils/basic-info-form-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { MainViewQuillEditor } from "@/components/quill/MainViewQuillEditor";
import { Separator } from "@/components/ui/separator";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";
import { useMutation } from "@tanstack/react-query";
import { handlePostStep1Data } from "../-services/assessment-services";
import { toast } from "sonner";
import { useSavedAssessmentStore } from "@/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/global-states";
import { AxiosError } from "axios";

const Step1BasicInfo: React.FC<StepContentProps> = ({
    currentStep,
    handleCompleteCurrentStep,
    completedSteps,
}) => {
    const { setSavedAssessmentId, setSavedAssessmentName } = useSavedAssessmentStore();
    const form = useForm<z.infer<typeof BasicInfoFormSchema>>({
        resolver: zodResolver(BasicInfoFormSchema),
        defaultValues: {
            status: completedSteps[currentStep] ? "COMPLETE" : "INCOMPLETE",
            testCreation: {
                assessmentName: "",
                subject: "",
                assessmentInstructions: "",
                liveDateRange: {
                    startDate: "2025-04-16T10:00:00Z",
                    endDate: "2025-04-20T18:00:00Z", // Default end date
                },
            },
            assessmentPreview: {
                checked: true, // Default to true, // Default preview time
                previewTimeLimit: "1 min",
            },
            reattemptCount: "1",
            submissionType: "",
            durationDistribution: "",
            evaluationType: "",
            switchSections: true, // Default to false
            raiseReattemptRequest: true, // Default to true
            raiseTimeIncreaseRequest: true, // Default to false
        },
        mode: "onChange", // Validate as user types
    });

    const { handleSubmit, control, getValues } = form;

    // We will use this function only to save the data
    const handleSubmitStep1Form = useMutation({
        mutationFn: ({ data }: { data: z.infer<typeof BasicInfoFormSchema> }) =>
            handlePostStep1Data(data),
        onSuccess: async (data) => {
            console.log(data);
            setSavedAssessmentId(data);
            setSavedAssessmentName(getValues("testCreation.assessmentName"));
            toast.success("Step 1 data has been saved successfully!", {
                className: "success-toast",
                duration: 2000,
            });
            handleCompleteCurrentStep();
        },
        onError: (error: unknown) => {
            if (error instanceof AxiosError) {
                toast.error(error.message, {
                    className: "error-toast",
                    duration: 2000,
                });
            } else {
                // Handle non-Axios errors if necessary
                console.error("Unexpected error:", error);
            }
        },
    });

    const onSubmit = (data: z.infer<typeof BasicInfoFormSchema>) => {
        const modifiedData = {
            ...data,
            testCreation: {
                ...data.testCreation,
                subject: "", //TODO: Add subject input field value here
            },
        };
        handleSubmitStep1Form.mutate({
            data: modifiedData,
        });
    };

    const onInvalid = (err: unknown) => {
        console.log(err);
    };

    return (
        <FormProvider {...form}>
            <form>
                <div className="m-0 flex items-center justify-between p-0">
                    <h1>Basic Information</h1>
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
                <div className="flex flex-col gap-6">
                    <div className="flex w-full items-start justify-start gap-4">
                        <div className="" id={"assessment-details"}>
                            <FormField
                                control={control}
                                name="testCreation.assessmentName"
                                render={({ field: { ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="text"
                                                inputPlaceholder="Add Title"
                                                input={field.value}
                                                labelStyle="font-thin"
                                                onChangeFunction={field.onChange}
                                                error={
                                                    form.formState.errors.testCreation
                                                        ?.assessmentName?.message
                                                }
                                                required={true}
                                                size="large"
                                                label="Assessment Name"
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* //TODO: Need to add subject input field here */}
                    </div>
                    <div className="flex flex-col gap-6" id="assessment-instructions">
                        <h1 className="-mb-5 font-thin">Assessment Instructions</h1>
                        <FormField
                            control={control}
                            name="testCreation.assessmentInstructions"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <MainViewQuillEditor
                                            onChange={field.onChange}
                                            value={field.value}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
            </form>
        </FormProvider>
    );
};

export default Step1BasicInfo;
