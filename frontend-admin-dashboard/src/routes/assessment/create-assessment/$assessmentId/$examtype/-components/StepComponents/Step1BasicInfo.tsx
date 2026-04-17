import { MyButton } from '@/components/design-system/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Info, CalendarRange, Settings2, Eye, ArrowLeftRight } from 'lucide-react';
import { StepContentProps } from '@/types/assessments/step-content-props';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useFilterDataForAssesment } from '../../../../../assessment-list/-utils.ts/useFiltersData';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { MyInput } from '@/components/design-system/input';
import SelectField from '@/components/design-system/select-field';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { timeLimit } from '@/constants/dummy-data';
import { BasicInfoFormSchema } from '../../-utils/basic-info-form-schema';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getAssessmentDetailsData, handlePostStep1Data } from '../../-services/assessment-services';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { getStepKey, getTimeLimitString, syncStep1DataWithStore } from '../../-utils/helper';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
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
import { CaretLeft } from '@phosphor-icons/react';
import { useParams } from '@tanstack/react-router';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { convertCapitalToTitleCase } from '@/lib/utils';

export function convertDateFormat(dateStr: string) {
    if (dateStr === '') return '';
    const date = new Date(dateStr);

    // Format it properly for datetime-local input
    return date.toISOString().slice(0, 16);
}

const SectionCard = ({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description?: string;
    children: React.ReactNode;
}) => (
    <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                    <Icon className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                    {description && (
                        <p className="text-xs text-slate-500">{description}</p>
                    )}
                </div>
            </div>
            <div className="flex flex-col gap-5">{children}</div>
        </CardContent>
    </Card>
);

// Helper component for navigation header
const NavigationHeader = ({ examType, isUpdate = false }: { examType: string; isUpdate?: boolean }) => {
    const handleBack = () => {
                    useBasicInfoStore.getState().reset();
                    window.history.back();
    };

    return (
        <div className="flex items-center gap-4">
            <CaretLeft onClick={handleBack} className="cursor-pointer" />
            <h1 className="text-lg">
                {isUpdate
                    ? (examType === 'SURVEY' ? 'Update Survey' : 'Update Assessment')
                    : (examType === 'SURVEY' ? 'Create Survey' : 'Create Assessment')
                }
            </h1>
        </div>
    );
};

// Helper component for test creation form fields
const TestCreationFields = ({ control, form, examType, instituteDetails }: any) => {
    return (
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
                                    label={examType === 'SURVEY' ? 'Survey Name' : 'Assessment Name'}
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
            <div className="" id={'subject-selection'}>
                <FormField
                    control={control}
                    name="testCreation.subject"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <SelectField
                                    label={getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}
                                    name="testCreation.subject"
                                    options={[]}
                                    control={control}
                                    required
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

// Helper component for live date range fields
const LiveDateRangeFields = ({ control, form }: any) => {
    return (
        <div className="flex w-full items-start justify-start gap-4">
            <div className="" id={'live-date-range-start'}>
                <FormField
                    control={control}
                    name="testCreation.liveDateRange.startDate"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <MyInput
                                    inputType="datetime-local"
                                    input={field.value}
                                    labelStyle="font-thin"
                                    onChangeFunction={field.onChange}
                                    error={
                                        form.formState.errors.testCreation?.liveDateRange
                                            ?.startDate?.message
                                    }
                                    required={true}
                                    size="large"
                                    label="Start Date & Time"
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
            <div className="" id={'live-date-range-end'}>
                <FormField
                    control={control}
                    name="testCreation.liveDateRange.endDate"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <MyInput
                                    inputType="datetime-local"
                                    input={field.value}
                                    labelStyle="font-thin"
                                    onChangeFunction={field.onChange}
                                    error={
                                        form.formState.errors.testCreation?.liveDateRange
                                            ?.endDate?.message
                                    }
                                    required={true}
                                    size="large"
                                    label="End Date & Time"
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

// Helper component for assessment instructions
const AssessmentInstructionsField = ({ control, form, examType }: any) => {
    return (
        <div className="flex w-full items-start justify-start">
            <div className="w-full" id={'assessment-instructions'}>
                <FormField
                    control={control}
                    name="testCreation.assessmentInstructions"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <div>
                                    <FormLabel>
                                        {examType === 'SURVEY'
                                            ? 'Survey Instructions'
                                            : 'Assessment Instructions'}
                                    </FormLabel>
                                    <RichTextEditor
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder={
                                            examType === 'SURVEY'
                                                ? 'Add Survey Instructions'
                                                : 'Add Assessment Instructions'
                                        }
                                    />
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

// Helper component for assessment preview settings
const AssessmentPreviewSettings = ({ control, form, timeLimit }: any) => {
    return (
        <div className="flex w-full items-start justify-start gap-4">
            <div className="" id={'assessment-preview-checkbox'}>
                <FormField
                    control={control}
                    name="assessmentPreview.checked"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        {...field}
                                    />
                                    <FormLabel>Enable Assessment Preview</FormLabel>
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
            <div className="" id={'assessment-preview-time-limit'}>
                <FormField
                    control={control}
                    name="assessmentPreview.previewTimeLimit"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <SelectField
                                    label="Preview Time Limit"
                                    name="assessmentPreview.previewTimeLimit"
                                    options={timeLimit}
                                    control={control}
                                    required
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

// Helper component for reattempt count
const ReattemptCountField = ({ control, form }: any) => {
    return (
        <div className="flex w-full items-start justify-start">
            <div className="" id={'reattempt-count'}>
                <FormField
                    control={control}
                    name="reattemptCount"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <MyInput
                                    inputType="number"
                                    inputPlaceholder="Enter Reattempt Count"
                                    input={field.value}
                                    labelStyle="font-thin"
                                    onChangeFunction={field.onChange}
                                    error={form.formState.errors.reattemptCount?.message}
                                    required={true}
                                    size="large"
                                    label="Reattempt Count"
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

// Helper component for submission type
const SubmissionTypeField = ({ control, form, examType }: any) => {
    return (
        <div className="flex w-full items-start justify-start">
            <div className="" id={'submission-type'}>
                <FormField
                    control={control}
                    name="submissionType"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <SelectField
                                    label="Submission Type"
                                    name="submissionType"
                                    options={[
                                        { value: 'AUTO_SUBMIT', label: 'Auto Submit', _id: 1 },
                                        { value: 'MANUAL_SUBMIT', label: 'Manual Submit', _id: 2 }
                                    ]}
                                    control={control}
                                    required
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

// Helper component for duration distribution
const DurationDistributionField = ({ control, form }: any) => {
    return (
        <div className="flex w-full items-start justify-start">
            <div className="" id={'duration-distribution'}>
                <FormField
                    control={control}
                    name="durationDistribution"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <SelectField
                                    label="Duration Distribution"
                                    name="durationDistribution"
                                    options={[
                                        { value: 'ASSESSMENT', label: 'Entire Assessment', _id: 1 },
                                        { value: 'SECTION', label: 'Section Wise', _id: 2 },
                                        { value: 'QUESTION', label: 'Question Wise', _id: 3 }
                                    ]}
                                    control={control}
                                    required
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Choose whether time limits apply to the whole test, per
                                    section, or per question.
                                </p>
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

// Helper component for evaluation type
const EvaluationTypeField = ({ control, form }: any) => {
    return (
        <div className="flex w-full items-start justify-start">
            <div className="" id={'evaluation-type'}>
                <FormField
                    control={control}
                    name="evaluationType"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <SelectField
                                    label="Evaluation Type"
                                    name="evaluationType"
                                    options={[
                                        { value: 'AUTO', label: 'Auto Evaluation', _id: 1 },
                                        { value: 'MANUAL', label: 'Manual Evaluation', _id: 2 }
                                    ]}
                                    control={control}
                                    required
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

// Helper component for switch sections checkbox
const SwitchSectionsField = ({ control }: any) => {
    return (
        <div className="flex w-full items-start justify-start">
            <div className="" id={'switch-sections'}>
                <FormField
                    control={control}
                    name="switchSections"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        {...field}
                                    />
                                    <FormLabel>Allow Switching Between Sections</FormLabel>
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

// Helper component for reattempt request checkbox
const ReattemptRequestField = ({ control }: any) => {
    return (
        <div className="flex w-full items-start justify-start">
            <div className="" id={'raise-reattempt-request'}>
                <FormField
                    control={control}
                    name="raiseReattemptRequest"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        {...field}
                                    />
                                    <FormLabel>Allow Students to Raise Reattempt Request</FormLabel>
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

// Helper component for time increase request checkbox
const TimeIncreaseRequestField = ({ control }: any) => {
    return (
        <div className="flex w-full items-start justify-start">
            <div className="" id={'raise-time-increase-request'}>
                <FormField
                    control={control}
                    name="raiseTimeIncreaseRequest"
                    render={({ field: { ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        {...field}
                                    />
                                    <FormLabel>Allow Students to Raise Time Increase Request</FormLabel>
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

const Step1BasicInfo: React.FC<StepContentProps> = ({
    currentStep,
    handleCompleteCurrentStep,
    completedSteps,
}) => {
    const queryClient = useQueryClient();
    const params = useParams({ strict: false });
    const examType = params.examtype || 'EXAM';
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
        // Handle validation errors
    };

    const [assessmentDetails, setAssessmentDetails] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

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
                // Handle error silently
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssessmentDetails();
    }, [assessmentId, instituteDetails?.id, examType]);

    useEffect(() => {
        if (assessmentId !== 'defaultId') {
            setNavHeading(<NavigationHeader examType={examType} isUpdate={true} />);
        } else {
            setNavHeading(<NavigationHeader examType={examType} isUpdate={false} />);
        }
    }, [assessmentId, examType, setNavHeading]);

    // Helper function to get test creation data
    const getTestCreationData = () => {
        const savedData = assessmentDetails[currentStep]?.saved_data;

        return {
            assessmentName: savedData?.name || '',
            subject: getSubjectNameById(
                            instituteDetails?.subjects || [],
                savedData?.subject_selection || ''
                        ) || '',
            assessmentInstructions: savedData?.instructions.content || '',
                    liveDateRange: {
                startDate: convertDateFormat(savedData?.boundation_start_date || '') || '',
                endDate: convertDateFormat(savedData?.boundation_end_date || '') || '',
            },
        };
    };

    // Helper function to get assessment preview data
    const getAssessmentPreviewData = () => {
        const assessmentPreview = assessmentDetails[currentStep]?.saved_data?.assessment_preview;

        return {
            checked: (assessmentPreview ?? 0) > 0,
            previewTimeLimit: assessmentPreview !== undefined
                ? getTimeLimitString(assessmentPreview ?? 0, timeLimit)
                : timeLimit[0],
        };
    };

    // Helper function to get form reset data
    const getFormResetData = () => {
        const savedData = assessmentDetails[currentStep]?.saved_data;

        return {
            status: assessmentDetails[currentStep]?.status,
            testCreation: getTestCreationData(),
            assessmentPreview: getAssessmentPreviewData(),
            reattemptCount: String(savedData?.reattempt_count) || '1',
            submissionType: savedData?.submission_type || '',
            durationDistribution: savedData?.duration_distribution || '',
            evaluationType: savedData?.evaluation_type || '',
            resultType: savedData?.result_type || 'MANUAL',
            switchSections: savedData?.can_switch_section,
            raiseReattemptRequest: savedData?.reattempt_consent,
            raiseTimeIncreaseRequest: savedData?.add_time_consent,
        };
    };

    useEffect(() => {
        if (assessmentId !== 'defaultId') {
            const formData = getFormResetData();
            form.reset(formData);
        }
    }, [assessmentDetails, currentStep, instituteDetails?.subjects, assessmentId]);

    if (isLoading || handleSubmitStep1Form.status === 'pending') return <DashboardLoader />;

    return (
        <FormProvider {...form}>
            <form>
                <div className="m-0 flex items-center justify-between p-0">
                    <div>
                        <h1>Basic Information</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Configure the basic details for your assessment including name,
                            schedule, evaluation method, and result release preferences.
                        </p>
                    </div>
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
                <div className="flex flex-col gap-5">
                    <SectionCard
                        icon={Info}
                        title={examType === 'SURVEY' ? 'Survey Information' : 'Basic Information'}
                        description="Name, subject, and instructions shown to participants."
                    >
                        <div
                            className="flex flex-wrap items-start gap-4"
                            id={'assessment-details'}
                        >
                            <FormField
                                control={control}
                                name="testCreation.assessmentName"
                                render={({ field: { ...field } }) => (
                                    <FormItem className="w-full sm:w-80">
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
                                                label={
                                                    examType === 'SURVEY'
                                                        ? 'Survey Name'
                                                        : 'Assessment Name'
                                                }
                                                {...field}
                                                className="!w-full"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <div className="w-full sm:w-72">
                                <SelectField
                                    label={getTerminology(
                                        ContentTerms.Subjects,
                                        SystemTerms.Subjects
                                    )}
                                    name="testCreation.subject"
                                    labelStyle="font-thin"
                                    options={SubjectFilterData.map((option, index) => ({
                                        value: option.name,
                                        label: convertCapitalToTitleCase(option.name),
                                        _id: index,
                                    }))}
                                    control={form.control}
                                    className="!w-full font-thin"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2" id="assessment-instructions">
                            <label className="text-sm font-medium text-slate-700">
                                {examType === 'SURVEY'
                                    ? 'Survey Instructions'
                                    : 'Assessment Instructions'}
                            </label>
                            <FormField
                                control={control}
                                name="testCreation.assessmentInstructions"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <RichTextEditor
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                value={field.value}
                                                placeholder={
                                                    examType === 'SURVEY'
                                                        ? 'Write the survey instructions'
                                                        : 'Write the assessment instructions'
                                                }
                                                minHeight={160}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </SectionCard>

                    {(getStepKey({
                        assessmentDetails,
                        currentStep,
                        key: 'boundation_start_date',
                    }) ||
                        getStepKey({
                            assessmentDetails,
                            currentStep,
                            key: 'boundation_end_date',
                        })) && (
                        <SectionCard
                            icon={CalendarRange}
                            title="Live Date Range"
                            description="When participants can start and must finish the assessment."
                        >
                            <div
                                className="flex flex-wrap items-start gap-4"
                                id="date-range"
                            >
                                {getStepKey({
                                    assessmentDetails,
                                    currentStep,
                                    key: 'boundation_start_date',
                                }) && (
                                    <FormField
                                        control={control}
                                        name="testCreation.liveDateRange.startDate"
                                        render={({ field: { ...field } }) => (
                                            <FormItem className="w-full sm:w-72">
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
                                                        className="!w-full"
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
                                            <FormItem className="w-full sm:w-72">
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
                                                        className="!w-full"
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                        </SectionCard>
                    )}

                    <SectionCard
                        icon={Settings2}
                        title="Attempt Settings"
                        description="Control how participants take this assessment."
                    >
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
                        <div>
                            <SelectField
                                label="Result & Evaluation Type"
                                name="resultType"
                                options={[
                                    {
                                        value: 'AUTO_AFTER_SUBMISSION',
                                        label: 'Auto - Result After Submission',
                                        _id: 0,
                                    },
                                    {
                                        value: 'AUTO_AFTER_ASSESSMENT_END',
                                        label: 'Auto - Results After Exam Ends',
                                        _id: 1,
                                    },
                                    {
                                        value: 'MANUAL',
                                        label: 'Manual',
                                        _id: 2,
                                    },
                                ]}
                                control={form.control}
                                className="w-64 font-thin"
                                required
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                                {watch('resultType') === 'AUTO_AFTER_SUBMISSION'
                                    ? 'System grades automatically. Results visible right after student submits.'
                                    : watch('resultType') === 'AUTO_AFTER_ASSESSMENT_END'
                                      ? 'System grades automatically. Results visible only after the assessment end time.'
                                      : watch('resultType') === 'MANUAL'
                                        ? 'Teacher grades by hand. Results hidden until admin releases them.'
                                        : 'Choose how this assessment is evaluated and when results are shown.'}
                            </p>
                        </div>
                        {watch('resultType') === 'MANUAL' &&
                            getStepKey({
                                assessmentDetails,
                                currentStep,
                                key: 'submission_type',
                            }) && (
                                <div>
                                    <SelectField
                                        label="Submission Type"
                                        name="submissionType"
                                        options={
                                            assessmentDetails[
                                                currentStep
                                            ]?.field_options?.submission_type?.map(
                                                (distribution: any, index: number) => ({
                                                    value: distribution.value,
                                                    label: distribution.value,
                                                    _id: index,
                                                })
                                            ) || []
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
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        How students submit their answers (e.g., file upload,
                                        PDF).
                                    </p>
                                </div>
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
                                    <FormItem className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/20 space-y-0">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                                                <Eye className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <FormLabel className="text-sm font-semibold text-slate-900">
                                                    {examType === 'SURVEY'
                                                        ? 'Allow Survey Preview'
                                                        : 'Allow Assessment Preview'}
                                                    {getStepKey({
                                                        assessmentDetails,
                                                        currentStep,
                                                        key: 'assessment_preview',
                                                    }) === 'REQUIRED' && (
                                                        <span className="ml-0.5 text-danger-600">
                                                            *
                                                        </span>
                                                    )}
                                                </FormLabel>
                                                <span className="text-xs text-slate-500">
                                                    Let participants preview the assessment before
                                                    starting.
                                                </span>
                                            </div>
                                        </div>
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
                        {watch('assessmentPreview.checked') && examType !== 'SURVEY' && (
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
                                    <FormItem className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/20 space-y-0">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                                                <ArrowLeftRight className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <FormLabel className="text-sm font-semibold text-slate-900">
                                                    Allow{' '}
                                                    {getTerminology(
                                                        RoleTerms.Learner,
                                                        SystemTerms.Learner
                                                    ).toLocaleLowerCase()}
                                                    s to switch between sections
                                                    {getStepKey({
                                                        assessmentDetails,
                                                        currentStep,
                                                        key: 'can_switch_section',
                                                    }) === 'REQUIRED' && (
                                                        <span className="ml-0.5 text-danger-600">
                                                            *
                                                        </span>
                                                    )}
                                                </FormLabel>
                                                <span className="text-xs text-slate-500">
                                                    Participants can jump back and forth between
                                                    sections.
                                                </span>
                                            </div>
                                        </div>
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
                    </SectionCard>
                </div>
            </form>
        </FormProvider>
    );
};

export default Step1BasicInfo;
