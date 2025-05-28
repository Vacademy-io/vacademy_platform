import { MyButton } from '@/components/design-system/button';
import { Separator } from '@/components/ui/separator';
import { StepContentProps } from '@/types/assessments/step-content-props';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useFilterDataForAssesment } from '../../../../../assessment-list/-utils.ts/useFiltersData';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { MyInput } from '@/components/design-system/input';
import SelectField from '@/components/design-system/select-field';
import { Switch } from '@/components/ui/switch';
import { timeLimit } from '@/constants/dummy-data';
import { BasicInfoFormSchema } from '../../-utils/basic-info-form-schema';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getAssessmentDetailsData, handlePostStep1Data } from '../../-services/assessment-services';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { getStepKey, getTimeLimitString, syncStep1DataWithStore } from '../../-utils/helper';
import { MainViewQuillEditor } from '@/components/quill/MainViewQuillEditor';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import {
    getIdBySubjectName,
    getSubjectNameById,
} from '@/routes/assessment/question-papers/-utils/helper';
import { useSavedAssessmentStore } from '../../-utils/global-states';
import { useBasicInfoStore } from '../../-utils/zustand-global-states/step1-basic-info';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { CaretLeft } from 'phosphor-react';
import { useParams } from '@tanstack/react-router';
import useIntroJsTour, { Step } from '@/hooks/use-intro';
import { IntroKey } from '@/constants/storage/introKey';
import { createAssesmentSteps } from '@/constants/intro/steps';
import { useSectionDetailsStore } from '../../-utils/zustand-global-states/step2-add-questions';
import { useTestAccessStore } from '../../-utils/zustand-global-states/step3-adding-participants';
import { useAccessControlStore } from '../../-utils/zustand-global-states/step4-access-control';
import { Steps } from '@/types/assessments/assessment-data-type';

export function convertDateFormat(dateStr: string) {
    if (dateStr === '') return '';
    const date = new Date(dateStr);

    // Format it properly for datetime-local input
    return date.toISOString().slice(0, 16);
}

const heading = (
    <div className="flex items-center gap-4">
        <CaretLeft
            onClick={() => {
                useBasicInfoStore.getState().reset();
                useSectionDetailsStore.getState().reset();
                useTestAccessStore.getState().reset();
                useAccessControlStore.getState().reset();
                window.history.back();
            }}
            className="cursor-pointer"
        />
        <h1 className="text-lg">Create Assessment</h1>
    </div>
);

const headingUpdate = (
    <div className="flex items-center gap-4">
        <CaretLeft
            onClick={() => {
                useBasicInfoStore.getState().reset();
                useSectionDetailsStore.getState().reset();
                useTestAccessStore.getState().reset();
                useAccessControlStore.getState().reset();
                window.history.back();
            }}
            className="cursor-pointer"
        />
        <h1 className="text-lg">Update Assessment</h1>
    </div>
);

const Step1BasicInfo: React.FC<StepContentProps> = ({
    currentStep,
    handleCompleteCurrentStep,
    completedSteps,
}) => {
    const queryClient = useQueryClient();
    const params = useParams({ strict: false });
    const examType = params.examtype;
    const assessmentId = params.assessmentId;
    const { setNavHeading } = useNavHeadingStore();
    const storeDataStep1 = useBasicInfoStore((state) => state);
    const { setSavedAssessmentId } = useSavedAssessmentStore();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());

    const { SubjectFilterData } = useFilterDataForAssesment(instituteDetails);

    const form = useForm<z.infer<typeof BasicInfoFormSchema>>({
        resolver: zodResolver(BasicInfoFormSchema),
        defaultValues: {
            status: completedSteps[currentStep] ? 'COMPLETE' : 'INCOMPLETE',
            testCreation: {
                assessmentName: storeDataStep1.testCreation?.assessmentName || '',
                subject: storeDataStep1.testCreation?.subject || '',
                assessmentInstructions: storeDataStep1.testCreation?.assessmentInstructions || '',
                liveDateRange: {
                    startDate: storeDataStep1.testCreation?.liveDateRange?.startDate || '', // Default start date
                    endDate: storeDataStep1.testCreation?.liveDateRange?.endDate || '', // Default end date
                },
            },
            assessmentPreview: {
                checked: storeDataStep1.assessmentPreview?.checked || true, // Default to true
                previewTimeLimit:
                    storeDataStep1.assessmentPreview?.previewTimeLimit || timeLimit[0], // Default preview time
            },
            reattemptCount: storeDataStep1.reattemptCount || '1',
            submissionType: storeDataStep1.submissionType || '',
            durationDistribution: storeDataStep1.durationDistribution || '',
            evaluationType: storeDataStep1.evaluationType || '',
            switchSections: storeDataStep1.switchSections || true, // Default to false
            raiseReattemptRequest: storeDataStep1.raiseReattemptRequest || true, // Default to true
            raiseTimeIncreaseRequest: storeDataStep1.raiseTimeIncreaseRequest || true, // Default to false
        },
        mode: 'onChange', // Validate as user types
    });

    const { handleSubmit, control, watch } = form;

    // Watch form fields
    const assessmentName = watch('testCreation.assessmentName');
    const liveDateRangeStartDate = watch('testCreation.liveDateRange.startDate');
    const liveDateRangeEndDate = watch('testCreation.liveDateRange.endDate');
    const reattemptCount = watch('reattemptCount');

    // Determine if all fields are filled
    const isFormValid =
        (examType === 'EXAM' || examType === 'SURVEY') && assessmentId === 'defaultId'
            ? !!assessmentName &&
              !!liveDateRangeStartDate &&
              !!liveDateRangeEndDate &&
              !!Number(reattemptCount) &&
              Object.entries(form.formState.errors).length === 0
            : !!assessmentName && Object.entries(form.formState.errors).length === 0;

    const handleSubmitStep1Form = useMutation({
        mutationFn: ({
            data,
            assessmentId,
            instituteId,
            type,
        }: {
            data: z.infer<typeof BasicInfoFormSchema>;
            assessmentId: string | null | undefined;
            instituteId: string | undefined;
            type: string | undefined;
        }) => handlePostStep1Data(data, assessmentId, instituteId, type),
        onSuccess: async (data) => {
            if (assessmentId !== 'defaultId') {
                useBasicInfoStore.getState().reset();
                window.history.back();
                toast.success('Step 1 data has been updated successfully!', {
                    className: 'success-toast',
                    duration: 2000,
                });
                queryClient.invalidateQueries({ queryKey: ['GET_ASSESSMENT_DETAILS'] });
            } else {
                setSavedAssessmentId(data.assessment_id);
                syncStep1DataWithStore(form);
                toast.success('Step 1 data has been saved successfully!', {
                    className: 'success-toast',
                    duration: 2000,
                });
                handleCompleteCurrentStep();
            }
        },
        onError: (error: unknown) => {
            if (error instanceof AxiosError) {
                toast.error(error.message, {
                    className: 'error-toast',
                    duration: 2000,
                });
            } else {
                // Handle non-Axios errors if necessary
                console.error('Unexpected error:', error);
            }
        },
    });

    const onSubmit = (data: z.infer<typeof BasicInfoFormSchema>) => {
        const modifiedData = {
            ...data,
            testCreation: {
                ...data.testCreation,
                subject: getIdBySubjectName(
                    instituteDetails?.subjects || [],
                    data.testCreation.subject
                ),
            },
        };
        handleSubmitStep1Form.mutate({
            data: modifiedData,
            assessmentId: assessmentId !== 'defaultId' ? assessmentId : null,
            instituteId: instituteDetails?.id,
            type: examType,
        });
    };

    const onInvalid = (err: unknown) => {
        console.log(err);
    };

    useIntroJsTour({
        key: IntroKey.assessmentStep1BasicInfo,
        steps: createAssesmentSteps
            .filter((step) => step.element === '#basic-info')
            .flatMap((step) => step.subStep || [])
            .filter((subStep): subStep is Step => subStep !== undefined),
    });

    const [assessmentDetails, setAssessmentDetails] = useState<Steps>([]);
    const [isLoading, setIsLoading] = useState(false);

    console.log(assessmentDetails);

    useEffect(() => {
        setIsLoading(true);
        const fetchAssessmentDetails = async () => {
            try {
                const response = await getAssessmentDetailsData({
                    assessmentId,
                    instituteId: instituteDetails?.id,
                    type: examType,
                });
                setAssessmentDetails(response);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssessmentDetails();
    }, [assessmentId, instituteDetails?.id, examType]);

    useEffect(() => {
        if (assessmentId !== 'defaultId') {
            setNavHeading(headingUpdate);
        } else {
            setNavHeading(heading);
        }
    }, []);

    useEffect(() => {
        if (assessmentId !== 'defaultId') {
            form.reset({
                status: assessmentDetails[currentStep]?.status,
                testCreation: {
                    assessmentName: assessmentDetails[currentStep]?.saved_data?.name || '',
                    subject:
                        getSubjectNameById(
                            instituteDetails?.subjects || [],
                            assessmentDetails[currentStep]?.saved_data?.subject_selection || ''
                        ) || '',
                    assessmentInstructions:
                        assessmentDetails[currentStep]?.saved_data?.instructions.content || '',
                    liveDateRange: {
                        startDate:
                            convertDateFormat(
                                assessmentDetails[currentStep]?.saved_data?.boundation_start_date ||
                                    ''
                            ) || '',
                        endDate:
                            convertDateFormat(
                                assessmentDetails[currentStep]?.saved_data?.boundation_end_date ||
                                    ''
                            ) || '',
                    },
                },
                assessmentPreview: {
                    checked:
                        (assessmentDetails[currentStep]?.saved_data?.assessment_preview ?? 0) > 0
                            ? true
                            : false, // Default to false if undefined or 0
                    previewTimeLimit:
                        assessmentDetails[currentStep]?.saved_data?.assessment_preview !== undefined
                            ? getTimeLimitString(
                                  assessmentDetails[currentStep]?.saved_data?.assessment_preview ??
                                      0, // Default to 0 if undefined
                                  timeLimit
                              )
                            : timeLimit[0], // Default preview time
                },
                reattemptCount:
                    String(assessmentDetails[currentStep]?.saved_data?.reattempt_count) || '1',
                submissionType: assessmentDetails[currentStep]?.saved_data?.submission_type || '',
                durationDistribution:
                    assessmentDetails[currentStep]?.saved_data?.duration_distribution || '',
                evaluationType: assessmentDetails[currentStep]?.saved_data?.evaluation_type || '',
                switchSections: assessmentDetails[currentStep]?.saved_data?.can_switch_section, // Default to false
                raiseReattemptRequest:
                    assessmentDetails[currentStep]?.saved_data?.reattempt_consent, // Default to true
                raiseTimeIncreaseRequest:
                    assessmentDetails[currentStep]?.saved_data?.add_time_consent, // Default to false
            });
        }
    }, [assessmentDetails, currentStep, instituteDetails?.subjects, assessmentId]);

    if (isLoading || handleSubmitStep1Form.status === 'pending') return <DashboardLoader />;

    return (
        <FormProvider {...form}>
            <form>
                <div className="m-0 flex items-center justify-between p-0">
                    <h1>Basic Information</h1>
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        disable={assessmentId === 'defaultId' ? !isFormValid : false}
                        onClick={handleSubmit(onSubmit, onInvalid)}
                    >
                        {assessmentId !== 'defaultId' ? 'Update' : 'Next'}
                    </MyButton>
                </div>
                <Separator className="my-4" />
                <div className="flex flex-col gap-6">
                    <div className="flex w-full items-start justify-start gap-4">
                        <div className="" id={'assessment-details'}>
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

                        {getStepKey({
                            assessmentDetails,
                            currentStep,
                            key: 'subject_selection',
                        }) && (
                            <SelectField
                                label="Subject"
                                name="testCreation.subject"
                                labelStyle="font-thin"
                                options={SubjectFilterData.map((option, index) => ({
                                    value: option.name,
                                    label: option.name,
                                    _id: index,
                                }))}
                                control={form.control}
                                className="mt-[8px] w-56 font-thin"
                                required={
                                    getStepKey({
                                        assessmentDetails,
                                        currentStep,
                                        key: 'subject_selection',
                                    }) === 'REQUIRED'
                                }
                            />
                        )}
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

                    {getStepKey({
                        assessmentDetails,
                        currentStep,
                        key: 'boundation_start_date',
                    }) &&
                        getStepKey({
                            assessmentDetails,
                            currentStep,
                            key: 'boundation_end_date',
                        }) && <h1>Live Date Range</h1>}
                    <div className="-mt-2 flex items-start gap-4" id="date-range">
                        {getStepKey({
                            assessmentDetails,
                            currentStep,
                            key: 'boundation_start_date',
                        }) && (
                            <FormField
                                control={control}
                                name="testCreation.liveDateRange.startDate"
                                render={({ field: { ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="datetime-local"
                                                input={field.value}
                                                onChangeFunction={field.onChange}
                                                error={
                                                    form.formState.errors.testCreation
                                                        ?.liveDateRange?.startDate?.message
                                                }
                                                required={
                                                    getStepKey({
                                                        assessmentDetails,
                                                        currentStep,
                                                        key: 'boundation_start_date',
                                                    }) === 'REQUIRED'
                                                }
                                                size="large"
                                                label="Start Date & Time"
                                                labelStyle="font-thin"
                                                {...field}
                                                className="w-full"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        )}
                        {getStepKey({
                            assessmentDetails,
                            currentStep,
                            key: 'boundation_end_date',
                        }) && (
                            <FormField
                                control={control}
                                name="testCreation.liveDateRange.endDate"
                                render={({ field: { ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="datetime-local"
                                                input={field.value}
                                                onChangeFunction={field.onChange}
                                                error={
                                                    form.formState.errors.testCreation
                                                        ?.liveDateRange?.endDate?.message
                                                }
                                                required={
                                                    getStepKey({
                                                        assessmentDetails,
                                                        currentStep,
                                                        key: 'boundation_end_date',
                                                    }) === 'REQUIRED'
                                                }
                                                size="large"
                                                label="End Date & Time"
                                                labelStyle="font-thin"
                                                {...field}
                                                className="w-full"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        )}
                    </div>
                    <Separator />
                    <h1>Attempt Settings</h1>
                    {(examType === 'EXAM' || examType === 'SURVEY') && (
                        <FormField
                            control={control}
                            name="reattemptCount"
                            render={({ field: { ...field } }) => (
                                <FormItem>
                                    <FormControl>
                                        <MyInput
                                            inputType="number"
                                            inputPlaceholder="Reattempt Count"
                                            input={field.value}
                                            labelStyle="text-[12px]"
                                            onChangeFunction={field.onChange}
                                            error={form.formState.errors?.reattemptCount?.message}
                                            required={true}
                                            size="large"
                                            label="Reattempt Count"
                                            {...field}
                                            min={0}
                                            onKeyDown={(e) => {
                                                if (e.key === '-' || e.key === 'e') {
                                                    e.preventDefault();
                                                }
                                            }}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    )}
                    <div className="flex flex-col gap-6" id="evaluation-type">
                        {getStepKey({
                            assessmentDetails,
                            currentStep,
                            key: 'evaluation_type',
                        }) && (
                            <SelectField
                                label="Evaluation Type"
                                name="evaluationType"
                                options={
                                    assessmentDetails[
                                        currentStep
                                    ]?.field_options?.evaluation_type?.map(
                                        (distribution, index) => ({
                                            value: distribution.value,
                                            label: distribution.value,
                                            _id: index,
                                        })
                                    ) || [] // Fallback to an empty array if undefined
                                }
                                control={form.control}
                                className="w-56 font-thin"
                                required={
                                    getStepKey({
                                        assessmentDetails,
                                        currentStep,
                                        key: 'evaluation_type',
                                    }) === 'REQUIRED'
                                }
                            />
                        )}
                        {watch('evaluationType') === 'MANUAL' &&
                            getStepKey({
                                assessmentDetails,
                                currentStep,
                                key: 'submission_type',
                            }) && (
                                <SelectField
                                    label="Submission Type"
                                    name="submissionType"
                                    options={
                                        assessmentDetails[
                                            currentStep
                                        ]?.field_options?.submission_type?.map(
                                            (distribution, index) => ({
                                                value: distribution.value,
                                                label: distribution.value,
                                                _id: index,
                                            })
                                        ) || [] // Fallback to an empty array if undefined
                                    }
                                    control={form.control}
                                    className="w-56 font-thin"
                                    required={
                                        getStepKey({
                                            assessmentDetails,
                                            currentStep,
                                            key: 'submission_type',
                                        }) === 'REQUIRED'
                                    }
                                />
                            )}
                    </div>

                    <div className="flex flex-col gap-6" id="attempt-settings">
                        {getStepKey({
                            assessmentDetails,
                            currentStep,
                            key: 'assessment_preview',
                        }) && (
                            <FormField
                                control={form.control}
                                name="assessmentPreview.checked"
                                render={({ field }) => (
                                    <FormItem className="flex w-1/2 items-center justify-between">
                                        <FormLabel>
                                            Allow Assessment Preview
                                            {getStepKey({
                                                assessmentDetails,
                                                currentStep,
                                                key: 'assessment_preview',
                                            }) === 'REQUIRED' && (
                                                <span className="text-subtitle text-danger-600">
                                                    *
                                                </span>
                                            )}
                                        </FormLabel>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        )}
                        {watch('assessmentPreview.checked') && (
                            <SelectField
                                label="Preview Time Limit"
                                labelStyle="font-thin"
                                name="assessmentPreview.previewTimeLimit"
                                options={timeLimit.map((option, index) => ({
                                    value: option,
                                    label: option,
                                    _id: index,
                                }))}
                                control={form.control}
                                required
                                className="w-56 font-thin"
                            />
                        )}
                        {getStepKey({
                            assessmentDetails,
                            currentStep,
                            key: 'can_switch_section',
                        }) && (
                            <FormField
                                control={form.control}
                                name="switchSections"
                                render={({ field }) => (
                                    <FormItem className="flex w-1/2 items-center justify-between">
                                        <FormLabel>
                                            Allow students to switch between sections
                                            {getStepKey({
                                                assessmentDetails,
                                                currentStep,
                                                key: 'can_switch_section',
                                            }) === 'REQUIRED' && (
                                                <span className="text-subtitle text-danger-600">
                                                    *
                                                </span>
                                            )}
                                        </FormLabel>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        )}
                        {/* will be adding this later
                        {getStepKey({
                            assessmentDetails,
                            currentStep,
                            key: "reattempt_consent",
                        }) && (
                            <FormField
                                control={form.control}
                                name="raiseReattemptRequest"
                                render={({ field }) => (
                                    <FormItem className="flex w-1/2 items-center justify-between">
                                        <FormLabel>
                                            Allow students to raise reattempt request
                                            {getStepKey({
                                                assessmentDetails,
                                                currentStep,
                                                key: "reattempt_consent",
                                            }) === "REQUIRED" && (
                                                <span className="text-subtitle text-danger-600">
                                                    *
                                                </span>
                                            )}
                                        </FormLabel>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        )}
                        {getStepKey({
                            assessmentDetails,
                            currentStep,
                            key: "add_time_consent",
                        }) && (
                            <FormField
                                control={form.control}
                                name="raiseTimeIncreaseRequest"
                                render={({ field }) => (
                                    <FormItem className="flex w-1/2 items-center justify-between">
                                        <FormLabel>
                                            Allow students to raise time increase request
                                            {getStepKey({
                                                assessmentDetails,
                                                currentStep,
                                                key: "add_time_consent",
                                            }) === "REQUIRED" && (
                                                <span className="text-subtitle text-danger-600">
                                                    *
                                                </span>
                                            )}
                                        </FormLabel>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        )} */}
                    </div>
                </div>
            </form>
        </FormProvider>
    );
};

export default Step1BasicInfo;
