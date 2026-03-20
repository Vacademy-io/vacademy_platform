import { StepContentProps } from '@/types/assessments/step-content-props';
import React, { useEffect, useRef, useState } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { MyButton } from '@/components/design-system/button';
import { z } from 'zod';
import testAccessSchema from '../../-utils/add-participants-schema';
import { Separator } from '@/components/ui/separator';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MyInput } from '@/components/design-system/input';
import {
    Copy,
    DotsSixVertical,
    DownloadSimple,
    PencilSimple,
    Plus,
    TrashSimple,
} from '@phosphor-icons/react';
import QRCode from 'react-qr-code';
import {
    copyToClipboard,
    getAllSessions,
    getCustomFieldsWhileEditStep3,
    getStepKey,
    handleDownloadQRCode,
    syncStep3DataWithStore,
    transformAllBatchData,
    transformBatchData,
} from '../../-utils/helper';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import SelectField from '@/components/design-system/select-field';
import { timeLimit } from '@/constants/dummy-data';
import { AddingParticipantsTab } from '../AddingParticipantsTab';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getAssessmentDetails, handlePostStep3Data } from '../../-services/assessment-services';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { useSavedAssessmentStore } from '../../-utils/global-states';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTestAccessStore } from '../../-utils/zustand-global-states/step3-adding-participants';
import { useParams } from '@tanstack/react-router';
import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import { convertDateFormat } from './Step1BasicInfo';
import { handleGetIndividualStudentList } from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-services/assessment-details-services';
import { getInstituteId } from '@/constants/helper';
import { Step3ParticipantsListIndiviudalStudentInterface } from '@/types/assessments/student-questionwise-status';
import { Sortable, SortableDragHandle, SortableItem } from '@/components/ui/sortable';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
type TestAccessFormType = z.infer<typeof testAccessSchema>;

const Step3AddingParticipants: React.FC<StepContentProps> = ({
    currentStep,
    handleCompleteCurrentStep,
    completedSteps,
}) => {
    const queryClient = useQueryClient();
    const params = useParams({ strict: false });
    const examType = params.examtype ?? '';
    const assessmentId = params.assessmentId ?? '';
    const instituteId = getInstituteId();
    const storeDataStep3 = useTestAccessStore((state) => state);
    const { savedAssessmentId } = useSavedAssessmentStore();
    const [selectedOptionValue, setSelectedOptionValue] = useState('textfield');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [textFieldValue, setTextFieldValue] = useState('');
    const [dropdownOptions, setDropdownOptions] = useState<
        {
            id: string;
            value: string;
            disabled: boolean;
        }[]
    >([]);

    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const { batches_for_sessions } = instituteDetails || {};
    const { data: assessmentDetails, isLoading } = useSuspenseQuery(
        getAssessmentDetails({
            assessmentId: assessmentId !== 'defaultId' ? assessmentId : savedAssessmentId,
            instituteId: instituteDetails?.id,
            type: examType,
        })
    );

    const sectionsInfo = getAllSessions(batches_for_sessions || []);

    const [selectedSection, setSelectedSection] = useState(sectionsInfo ? sectionsInfo[0]?.id : '');

    // Extract batch IDs from preBatchData
    const batchIds = new Set(
        assessmentDetails[currentStep]?.saved_data.pre_batch_registrations.map(
            (batch) => batch.batchId
        )
    );

    // Filter matching batches
    const matchedBatches = batches_for_sessions?.filter((batch: any) => batchIds.has(batch.id));
    const transformedBatches =
        assessmentId !== 'defaultId'
            ? transformAllBatchData(matchedBatches || [])
            : transformBatchData(batches_for_sessions || [], selectedSection!);

    const oldFormData = useRef<TestAccessFormType | null>(null);

    const form = useForm<TestAccessFormType>({
        resolver: zodResolver(testAccessSchema),
        defaultValues: {
            status: completedSteps[currentStep] ? 'COMPLETE' : 'INCOMPLETE',
            closed_test:
                storeDataStep3?.open_test?.checked ||
                assessmentDetails[0]?.saved_data?.assessment_visibility === 'PUBLIC'
                    ? false
                    : true,
            open_test: storeDataStep3?.open_test || {
                checked: false,
                start_date: '',
                end_date: '',
                instructions: '',
                custom_fields: [
                    {
                        id: '0',
                        type: 'textfield',
                        name: 'Full Name',
                        oldKey: true,
                        isRequired: true,
                        key: 'full_name',
                        order: 0,
                    },
                    {
                        id: '1',
                        type: 'textfield',
                        name: 'Email',
                        oldKey: true,
                        isRequired: true,
                        key: 'email',
                        order: 1,
                    },
                    {
                        id: '2',
                        type: 'textfield',
                        name: 'Phone Number',
                        oldKey: true,
                        isRequired: true,
                        key: 'phone_number',
                        order: 2,
                    },
                ],
            },
            select_batch: storeDataStep3?.select_batch || {
                checked: false,
                batch_details: {},
            },
            select_individually: storeDataStep3?.select_individually || {
                checked: false,
                student_details: [],
            },
            join_link:
                storeDataStep3?.join_link ||
                `${BASE_URL_LEARNER_DASHBOARD}/register?code=${assessmentDetails[0]?.saved_data.assessment_url}`,
            show_leaderboard: storeDataStep3?.show_leaderboard || true,
            notify_student: storeDataStep3?.notify_student || {
                when_assessment_created: true,
                before_assessment_goes_live: {
                    checked: true,
                    value: '1 min',
                },
                when_assessment_live: true,
                when_assessment_report_generated: true,
            },
            notify_parent: storeDataStep3?.notify_parent || {
                when_assessment_created: true,
                before_assessment_goes_live: {
                    checked: true,
                    value: '1 min',
                },
                when_assessment_live: true,
                when_student_appears: true,
                when_student_finishes_test: true,
                when_assessment_report_generated: true,
            },
        },
        mode: 'onChange',
    });

    const { handleSubmit, getValues, control, watch, setValue } = form;
    const customFields = getValues('open_test.custom_fields');
    watch('open_test.custom_fields');

    const { fields: customFieldsArray, move: moveCustomField } = useFieldArray({
        control,
        name: 'open_test.custom_fields',
    });

    const handleSubmitStep3Form = useMutation({
        mutationFn: ({
            oldFormData,
            data,
            assessmentId,
            instituteId,
            type,
            actionType,
        }: {
            oldFormData: TestAccessFormType | null;
            data: z.infer<typeof testAccessSchema>;
            assessmentId: string | null;
            instituteId: string | undefined;
            type: string | undefined;
            actionType: string;
        }) => handlePostStep3Data(oldFormData, data, assessmentId, instituteId, type, actionType),
        onSuccess: () => {
            if (assessmentId !== 'defaultId') {
                useTestAccessStore.getState().reset();
                window.history.back();
                toast.success('Step 3 data has been updated successfully!', {
                    className: 'success-toast',
                    duration: 2000,
                });
                queryClient.invalidateQueries({ queryKey: ['GET_ASSESSMENT_DETAILS'] });
                queryClient.invalidateQueries({ queryKey: ['GET_INDIVIDUAL_STUDENT_DETAILS'] });
            } else {
                syncStep3DataWithStore(form);
                toast.success('Step 3 data has been saved successfully!', {
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

    const onSubmit = (data: z.infer<typeof testAccessSchema>) => {
        handleSubmitStep3Form.mutate({
            oldFormData: oldFormData.current,
            data: data,
            assessmentId: assessmentId !== 'defaultId' ? assessmentId : savedAssessmentId,
            instituteId: instituteDetails?.id,
            type: examType,
            actionType: assessmentId !== 'defaultId' ? 'update' : 'create',
        });
    };

    const onInvalid = (err: unknown) => {
        // Scroll to the first error field
        const firstErrorField = document.querySelector('[data-error="true"]');
        if (firstErrorField) {
            firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const toggleIsRequired = (id: string) => {
        const updatedFields = customFieldsArray?.map((field) =>
            field.id === id ? { ...field, isRequired: !field.isRequired } : field
        );
        setValue('open_test.custom_fields', updatedFields);
    };

    const handleAddDropdownOptions = () => {
        setDropdownOptions((prevOptions) => [
            ...prevOptions,
            {
                id: String(prevOptions.length),
                value: `option ${prevOptions.length + 1}`,
                disabled: true,
            },
        ]);
    };

    const handleAddOpenFieldValues = (type: string, name: string, oldKey: boolean) => {
        // Add the new field to the array
        const updatedFields = [
            ...customFields,
            {
                id: String(customFields.length), // Use the current array length as the new ID
                type,
                name,
                oldKey,
                isRequired: true,
                key: '',
                order: customFields.length,
            },
        ];

        // Update the form state with the new array
        setValue('open_test.custom_fields', updatedFields);
    };
    const handleDeleteOpenField = (id: string) => {
        const updatedFields = customFieldsArray
            .filter((field) => field.id !== id)
            .map((field, index) => ({
                ...field,
                order: index, // Update order of remaining fields
            }));
        setValue('open_test.custom_fields', updatedFields);
    };

    const handleDeleteOptionField = (id: string) => {
        setDropdownOptions((prevFields) => prevFields.filter((field) => field.id !== id));
    };

    const handleAddGender = (type: string, name: string, oldKey: boolean) => {
        // Create the new field
        const newField = {
            id: String(customFields.length), // Use the current array length as the new ID
            type,
            name,
            oldKey,
            ...(type === 'dropdown' && {
                options: [
                    {
                        id: '0',
                        value: 'MALE',
                        disabled: true,
                    },
                    {
                        id: '1',
                        value: 'FEMALE',
                        disabled: true,
                    },
                    {
                        id: '2',
                        value: 'OTHER',
                        disabled: true,
                    },
                ],
            }), // Include options if type is dropdown
            isRequired: true,
            key: '',
            order: customFields.length,
        };

        // Add the new field to the array
        const updatedFields = [...customFields, newField];

        // Update the form state
        setValue('open_test.custom_fields', updatedFields);
    };

    // Function to close the dialog
    const handleCloseDialog = (type: string, name: string, oldKey: boolean) => {
        // Create the new field
        const newField = {
            id: String(customFields.length), // Use the current array length as the new ID
            type,
            name,
            oldKey,
            ...(type === 'dropdown' && { options: dropdownOptions }), // Include options if type is dropdown
            isRequired: true,
            key: '',
            order: customFields.length,
        };

        // Add the new field to the array
        const updatedFields = [...customFields, newField];

        // Update the form state
        setValue('open_test.custom_fields', updatedFields);

        // Reset dialog and temporary values
        setIsDialogOpen(false);
        setTextFieldValue('');
        setDropdownOptions([]);
    };

    const handleValueChange = (id: string, newValue: string) => {
        setDropdownOptions((prevOptions) =>
            prevOptions.map((option) =>
                option.id === id ? { ...option, value: newValue } : option
            )
        );
    };

    const handleEditClick = (id: string) => {
        setDropdownOptions((prevOptions) =>
            prevOptions.map((option) =>
                option.id === id ? { ...option, disabled: !option.disabled } : option
            )
        );
    };

    // Function that explicitly updates the order property of all fields
    const updateFieldOrders = () => {
        const currentFields = getValues('open_test.custom_fields');

        if (!currentFields) return;

        // Create a copy with updated order values matching their array positions
        const updatedFields = currentFields.map((field, index) => ({
            ...field,
            order: index,
        }));

        // Update the form values
        setValue('open_test.custom_fields', updatedFields, {
            shouldDirty: true,
            shouldTouch: true,
        });
    };

    const { data: studentList } = useSuspenseQuery(
        handleGetIndividualStudentList({ instituteId, assessmentId })
    );

    // Helper functions for student list processing
    const isAdminPreRegistered = (user: Step3ParticipantsListIndiviudalStudentInterface): boolean => {
        return user.source === 'ADMIN_PRE_REGISTRATION';
    };

    const transformUserToStudentDetails = (user: Step3ParticipantsListIndiviudalStudentInterface) => ({
        username: user.username,
        user_id: user.userId,
        email: user.userEmail,
        full_name: user.participantName,
        mobile_number: user.phoneNumber,
        guardian_email: '',
        guardian_mobile_number: '',
        file_id: user.faceFileId,
        reattempt_count: user.reattemptCount,
    });

    // Helper function to get checked student list
    const getCheckedStudentList = () => {
        return studentList
            .filter(isAdminPreRegistered)
            .map(transformUserToStudentDetails);
    };

    // Helper functions for notification settings
    const getNotificationTimeValue = (timeInMinutes: number | undefined): string => {
        return timeInMinutes ? `${timeInMinutes} min` : '1 min';
    };

    const getNotificationChecked = (timeInMinutes: number | undefined): boolean => {
        return timeInMinutes !== 0;
    };

    const getStudentNotificationSettings = (notifications: any) => ({
        when_assessment_created: notifications?.participant_when_assessment_created || false,
        before_assessment_goes_live: {
            checked: getNotificationChecked(notifications?.participant_before_assessment_goes_live),
            value: getNotificationTimeValue(notifications?.participant_before_assessment_goes_live),
        },
        when_assessment_live: notifications?.participant_when_assessment_live || false,
        when_assessment_report_generated: notifications?.participant_when_assessment_report_generated || false,
    });

    const getParentNotificationSettings = (notifications: any) => ({
        when_assessment_created: notifications?.parent_when_assessment_created || false,
        before_assessment_goes_live: {
            checked: getNotificationChecked(notifications?.parent_before_assessment_goes_live),
            value: getNotificationTimeValue(notifications?.parent_before_assessment_goes_live),
        },
        when_assessment_live: notifications?.parent_when_assessment_live || false,
        when_student_appears: true,
        when_student_finishes_test: true,
        when_assessment_report_generated: notifications?.parent_when_assessment_report_generated || false,
    });

    // Helper function to get notification settings
    const getNotificationSettings = () => {
        const notifications = assessmentDetails[currentStep]?.saved_data?.notifications;

        return {
            notify_student: getStudentNotificationSettings(notifications),
            notify_parent: getParentNotificationSettings(notifications),
        };
    };

    // Helper function to get open test settings
    const getOpenTestSettings = (savedData: any) => ({
        checked: assessmentDetails[0]?.saved_data?.assessment_visibility === 'PUBLIC',
        start_date: savedData?.registration_open_date
            ? convertDateFormat(savedData.registration_open_date)
            : '',
        end_date: savedData?.registration_close_date
            ? convertDateFormat(savedData.registration_close_date)
            : '',
        instructions: '',
        custom_fields: getCustomFieldsWhileEditStep3(assessmentDetails),
    });

    // Helper function to get batch selection settings
    const getBatchSelectionSettings = () => ({
        checked: true,
        batch_details: Object.fromEntries(
            Object.entries(transformedBatches).map(([key, value]) => [
                key,
                value.map((item) => item.id),
            ])
        ),
    });

    // Helper function to get individual selection settings
    const getIndividualSelectionSettings = () => ({
        checked: false,
        student_details: getCheckedStudentList(),
    });

    // Helper function to get initial form values
    const getInitialFormValues = () => {
        const checkedStudentList = getCheckedStudentList();
        const notificationSettings = getNotificationSettings();
        const savedData = assessmentDetails[currentStep]?.saved_data;

        return {
            status: completedSteps[currentStep] ? 'COMPLETE' : 'INCOMPLETE',
            closed_test: assessmentDetails[0]?.saved_data?.assessment_visibility === 'PRIVATE',
            open_test: getOpenTestSettings(savedData),
            select_batch: getBatchSelectionSettings(),
            select_individually: getIndividualSelectionSettings(),
            join_link: getJoinLink(),
            show_leaderboard: getShowLeaderboardSetting(savedData),
            ...notificationSettings,
        };
    };

    const getJoinLink = () => {
        return `${BASE_URL_LEARNER_DASHBOARD}/register?code=${assessmentDetails[0]?.saved_data.assessment_url}` || '';
    };

    const getShowLeaderboardSetting = (savedData: any) => {
        return savedData?.notifications?.participant_show_leaderboard || false;
    };

    useEffect(() => {
        if (assessmentId !== 'defaultId') {
            const initialValues = getInitialFormValues();

            // Store the initial values in the ref
            oldFormData.current = JSON.parse(JSON.stringify(initialValues));

            // Reset form with these values
            form.reset(initialValues);
        }
    }, [assessmentId, assessmentDetails, storeDataStep3, selectedSection]);

    if (isLoading) return <DashboardLoader />;

    return (
        <FormProvider {...form}>
            <form>
                <div className="m-0 flex items-center justify-between p-0">
                    <h1>Add Participants</h1>
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        onClick={handleSubmit(onSubmit, onInvalid)}
                    >
                        {assessmentId !== 'defaultId' ? 'Update' : 'Next'}
                    </MyButton>
                </div>
                <Separator className="my-4" />
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3" id="open-assessment">
                        <h1>Participant Access Settings</h1>
                        <FormField
                            control={form.control}
                            name="closed_test" // Use the parent key to handle both fields
                            render={() => (
                                <FormItem className="space-y-3">
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={(value) => {
                                                form.setValue(
                                                    'closed_test',
                                                    value === 'CLOSE_TEST'
                                                );
                                                form.setValue(
                                                    'open_test.checked',
                                                    value === 'OPEN_TEST'
                                                );
                                            }}
                                            defaultValue={
                                                getValues('closed_test')
                                                    ? 'CLOSE_TEST'
                                                    : 'OPEN_TEST'
                                            }
                                            className="flex flex-col gap-3"
                                        >
                                            {getStepKey({
                                                assessmentDetails,
                                                currentStep,
                                                key: 'closed_link',
                                            }) === 'REQUIRED' && (
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value="CLOSE_TEST" />
                                                    </FormControl>
                                                    <FormLabel className="font-semibold">
                                                        Closed Test:{' '}
                                                        <span className="font-thin">
                                                            {examType === 'SURVEY' ? 'Restrict the Survey to specific' : 'Restrict the Assessment to specific'}
                                                            participants by assigning it to
                                                            institute batches or selecting
                                                            individual{' '}
                                                            {getTerminology(
                                                                RoleTerms.Learner,
                                                                SystemTerms.Learner
                                                            ).toLocaleLowerCase()}
                                                            s.
                                                        </span>
                                                    </FormLabel>
                                                </FormItem>
                                            )}
                                            {getStepKey({
                                                assessmentDetails,
                                                currentStep,
                                                key: 'open_link',
                                            }) === 'REQUIRED' && (
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value="OPEN_TEST" />
                                                    </FormControl>
                                                    <FormLabel className="font-semibold">
                                                        Open Test:{' '}
                                                        <span className="font-thin">
                                                            Allow anyone to register for this
                                                            {examType === 'SURVEY' ? 'Survey' : 'Assessment'} via a shared link. Institute
                                                            {getTerminology(
                                                                RoleTerms.Learner,
                                                                SystemTerms.Learner
                                                            ).toLocaleLowerCase()}
                                                            s can also be pre-registered by
                                                            selecting batches or individuals.
                                                        </span>
                                                    </FormLabel>
                                                </FormItem>
                                            )}
                                        </RadioGroup>
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                    {watch('open_test.checked') && (
                        <>
                            <div className="mt-2 flex flex-col gap-4">
                                <h1>{examType === 'SURVEY' ? 'Survey Registration' : 'Assessment Registration'}</h1>
                                <div className="-mt-2 flex items-start gap-4">
                                    {getStepKey({
                                        assessmentDetails,
                                        currentStep,
                                        key: 'registration_open_date',
                                    }) === 'REQUIRED' && (
                                        <FormField
                                            control={control}
                                            name="open_test.start_date"
                                            render={({ field: { ...field } }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <MyInput
                                                            inputType="datetime-local"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                            error={
                                                                form.formState.errors.open_test
                                                                    ?.start_date?.message
                                                            }
                                                            required
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
                                        key: 'registration_close_date',
                                    }) === 'REQUIRED' && (
                                        <FormField
                                            control={control}
                                            name="open_test.end_date"
                                            render={({ field: { ...field } }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <MyInput
                                                            inputType="datetime-local"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                            error={
                                                                form.formState.errors.open_test
                                                                    ?.end_date?.message
                                                            }
                                                            required
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
                            </div>
                            <div className="mt-2 flex flex-col gap-6">
                                <h1 className="-mb-5">{examType === 'SURVEY' ? 'About Survey Registration' : 'About Assessment Registration'}</h1>
                                <FormField
                                    control={control}
                                    name="open_test.instructions"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <RichTextEditor
                                                    onChange={field.onChange}
                                                    onBlur={field.onBlur}
                                                    value={field.value}
                                                    placeholder="Registration instructions"
                                                    minHeight={120}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {getStepKey({
                                assessmentDetails,
                                currentStep,
                                key: 'registration_form_fields',
                            }) === 'REQUIRED' && (
                                <div className="flex w-full flex-col gap-4">
                                    <h1>Registration Input Field</h1>
                                    <div className="flex flex-col gap-4">
                                        <Sortable
                                            value={customFieldsArray}
                                            onMove={({ activeIndex, overIndex }) => {
                                                moveCustomField(activeIndex, overIndex);
                                                updateFieldOrders();
                                            }}
                                        >
                                            <div className="flex flex-col gap-4">
                                                {customFieldsArray.map((field, index) => {
                                                    return (
                                                        <SortableItem
                                                            key={field.id}
                                                            value={field.id}
                                                            asChild
                                                        >
                                                            <div
                                                                key={index}
                                                                className="flex items-center gap-4"
                                                            >
                                                                <div className="flex w-3/4 items-center justify-between rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2">
                                                                    <h1 className="text-sm">
                                                                        {field.name}
                                                                        {field.oldKey && (
                                                                            <span className="text-subtitle text-danger-600">
                                                                                *
                                                                            </span>
                                                                        )}
                                                                        {!field.oldKey &&
                                                                            field.isRequired && (
                                                                                <span className="text-subtitle text-danger-600">
                                                                                    *
                                                                                </span>
                                                                            )}
                                                                    </h1>
                                                                    <div className="flex items-center gap-6">
                                                                        {!field.oldKey && (
                                                                            <MyButton
                                                                                type="button"
                                                                                scale="small"
                                                                                buttonType="secondary"
                                                                                className="min-w-6 !rounded-sm !p-0"
                                                                                onClick={() =>
                                                                                    handleDeleteOpenField(
                                                                                        field.id
                                                                                    )
                                                                                }
                                                                            >
                                                                                <TrashSimple className="!size-4 text-danger-500" />
                                                                            </MyButton>
                                                                        )}
                                                                        <SortableDragHandle
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="cursor-grab"
                                                                        >
                                                                            <DotsSixVertical
                                                                                size={20}
                                                                            />
                                                                        </SortableDragHandle>
                                                                    </div>
                                                                </div>
                                                                {!field.oldKey && (
                                                                    <>
                                                                        <h1 className="text-sm">
                                                                            Required
                                                                        </h1>
                                                                        <Switch
                                                                            checked={
                                                                                field.isRequired
                                                                            }
                                                                            onCheckedChange={() =>
                                                                                toggleIsRequired(
                                                                                    field.id
                                                                                )
                                                                            }
                                                                        />
                                                                    </>
                                                                )}
                                                            </div>
                                                        </SortableItem>
                                                    );
                                                })}
                                            </div>
                                        </Sortable>
                                    </div>
                                    <div className="mt-2 flex items-center gap-6">
                                        {!customFields?.some(
                                            (field) => field.name === 'Gender'
                                        ) && (
                                            <MyButton
                                                type="button"
                                                scale="medium"
                                                buttonType="secondary"
                                                onClick={() =>
                                                    handleAddGender('dropdown', 'Gender', false)
                                                }
                                            >
                                                <Plus size={32} /> Add Gender
                                            </MyButton>
                                        )}
                                        {!customFields?.some((field) => field.name === 'State') && (
                                            <MyButton
                                                type="button"
                                                scale="medium"
                                                buttonType="secondary"
                                                onClick={() =>
                                                    handleAddOpenFieldValues(
                                                        'textfield',
                                                        'State',
                                                        false
                                                    )
                                                }
                                            >
                                                <Plus size={32} /> Add State
                                            </MyButton>
                                        )}
                                        {!customFields?.some((field) => field.name === 'City') && (
                                            <MyButton
                                                type="button"
                                                scale="medium"
                                                buttonType="secondary"
                                                onClick={() =>
                                                    handleAddOpenFieldValues(
                                                        'textfield',
                                                        'City',
                                                        false
                                                    )
                                                }
                                            >
                                                <Plus size={32} /> Add City
                                            </MyButton>
                                        )}
                                        {!customFields?.some(
                                            (field) => field.name === 'School/College'
                                        ) && (
                                            <MyButton
                                                type="button"
                                                scale="medium"
                                                buttonType="secondary"
                                                onClick={() =>
                                                    handleAddOpenFieldValues(
                                                        'textfield',
                                                        'School/College',
                                                        false
                                                    )
                                                }
                                            >
                                                <Plus size={32} /> Add School/College
                                            </MyButton>
                                        )}
                                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                            <DialogTrigger>
                                                <MyButton
                                                    type="button"
                                                    scale="medium"
                                                    buttonType="secondary"
                                                >
                                                    <Plus size={32} /> Add Custom Field
                                                </MyButton>
                                            </DialogTrigger>
                                            <DialogContent className="!w-[500px] p-0">
                                                <h1 className="rounded-lg bg-primary-50 p-4 text-primary-500">
                                                    Add Custom Field
                                                </h1>
                                                <div className="flex flex-col gap-4 px-4">
                                                    <h1>
                                                        Select the type of custom field you want to
                                                        add:
                                                    </h1>
                                                    <RadioGroup
                                                        defaultValue={selectedOptionValue}
                                                        onValueChange={(value) =>
                                                            setSelectedOptionValue(value)
                                                        }
                                                        className="flex items-center gap-6"
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem
                                                                value="textfield"
                                                                id="option-one"
                                                            />
                                                            <Label htmlFor="option-one">
                                                                Text Field
                                                            </Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem
                                                                value="dropdown"
                                                                id="option-two"
                                                            />
                                                            <Label htmlFor="option-two">
                                                                Dropdown
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                    {selectedOptionValue === 'textfield' ? (
                                                        <div className="flex flex-col gap-1">
                                                            <h1>
                                                                Text Field Name
                                                                <span className="text-subtitle text-danger-600">
                                                                    *
                                                                </span>
                                                            </h1>
                                                            <MyInput
                                                                inputType="text"
                                                                inputPlaceholder="Type Here"
                                                                input={textFieldValue}
                                                                onChangeFunction={(e) =>
                                                                    setTextFieldValue(
                                                                        e.target.value
                                                                    )
                                                                }
                                                                size="large"
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            <h1>
                                                                Dropdown Name
                                                                <span className="text-subtitle text-danger-600">
                                                                    *
                                                                </span>
                                                            </h1>
                                                            <MyInput
                                                                inputType="text"
                                                                inputPlaceholder="Type Here"
                                                                input={textFieldValue}
                                                                onChangeFunction={(e) =>
                                                                    setTextFieldValue(
                                                                        e.target.value
                                                                    )
                                                                }
                                                                size="large"
                                                                className="w-full"
                                                            />
                                                            <h1 className="mt-4">
                                                                Dropdown Options
                                                            </h1>
                                                            <div className="flex flex-col gap-4">
                                                                {dropdownOptions.map((option) => {
                                                                    return (
                                                                        <div
                                                                            className="flex w-full items-center justify-between rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-1"
                                                                            key={option.id} // Use unique identifier
                                                                        >
                                                                            <MyInput
                                                                                inputType="text"
                                                                                inputPlaceholder={
                                                                                    option.value
                                                                                }
                                                                                input={option.value}
                                                                                onChangeFunction={(
                                                                                    e
                                                                                ) =>
                                                                                    handleValueChange(
                                                                                        option.id,
                                                                                        e.target
                                                                                            .value
                                                                                    )
                                                                                }
                                                                                size="large"
                                                                                disabled={
                                                                                    option.disabled
                                                                                }
                                                                                className="border-none pl-0"
                                                                            />
                                                                            <div className="flex items-center gap-6">
                                                                                <MyButton
                                                                                    type="button"
                                                                                    scale="medium"
                                                                                    buttonType="secondary"
                                                                                    className="h-6 min-w-6 !rounded-sm px-1"
                                                                                    onClick={() =>
                                                                                        handleEditClick(
                                                                                            option.id
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <PencilSimple
                                                                                        size={32}
                                                                                    />
                                                                                </MyButton>
                                                                                {dropdownOptions.length >
                                                                                    1 && (
                                                                                    <MyButton
                                                                                        type="button"
                                                                                        scale="medium"
                                                                                        buttonType="secondary"
                                                                                        onClick={() =>
                                                                                            handleDeleteOptionField(
                                                                                                option.id
                                                                                            )
                                                                                        }
                                                                                        className="h-6 min-w-6 !rounded-sm px-1"
                                                                                    >
                                                                                        <TrashSimple className="!size-4 text-danger-500" />
                                                                                    </MyButton>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            <MyButton
                                                                type="button"
                                                                scale="small"
                                                                buttonType="secondary"
                                                                className="mt-2 w-20 min-w-4 border-none font-thin !text-primary-500"
                                                                onClick={handleAddDropdownOptions}
                                                            >
                                                                <Plus size={18} />
                                                                Add
                                                            </MyButton>
                                                        </div>
                                                    )}
                                                    <div className="mb-6 flex justify-center">
                                                        <MyButton
                                                            type="button"
                                                            scale="medium"
                                                            buttonType="primary"
                                                            className="mt-4 w-fit"
                                                            onClick={() =>
                                                                handleCloseDialog(
                                                                    selectedOptionValue,
                                                                    textFieldValue,
                                                                    false
                                                                )
                                                            }
                                                        >
                                                            Done
                                                        </MyButton>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                    <Dialog>
                                        <DialogTrigger className="flex justify-start">
                                            <MyButton
                                                type="button"
                                                scale="medium"
                                                buttonType="secondary"
                                                className="mt-4 w-fit"
                                            >
                                                Preview Registration Form
                                            </MyButton>
                                        </DialogTrigger>
                                        <DialogContent className="p-0">
                                            <h1 className="rounded-md bg-primary-50 p-4 font-semibold text-primary-500">
                                                Preview Registration Form
                                            </h1>
                                            <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto px-4 py-2">
                                                {customFields?.map((testInputFields, idx) => {
                                                    return (
                                                        <div
                                                            className="flex flex-col items-start gap-4"
                                                            key={idx}
                                                        >
                                                            {testInputFields.type === 'dropdown' ? (
                                                                <SelectField
                                                                    label={testInputFields.name}
                                                                    labelStyle="font-normal"
                                                                    name={testInputFields.name}
                                                                    options={
                                                                        testInputFields?.options?.map(
                                                                            (option, index) => ({
                                                                                value: option.value,
                                                                                label: option.value,
                                                                                _id: index,
                                                                            })
                                                                        ) || []
                                                                    }
                                                                    control={form.control}
                                                                    className="w-full font-thin"
                                                                    required={
                                                                        testInputFields.isRequired
                                                                            ? true
                                                                            : false
                                                                    }
                                                                />
                                                            ) : (
                                                                <div className="flex w-full flex-col gap-[0.4rem]">
                                                                    <h1 className="text-sm">
                                                                        {testInputFields.name}
                                                                        {testInputFields.isRequired && (
                                                                            <span className="text-subtitle text-danger-600">
                                                                                *
                                                                            </span>
                                                                        )}
                                                                    </h1>
                                                                    <MyInput
                                                                        inputType="text"
                                                                        inputPlaceholder={
                                                                            testInputFields.name
                                                                        }
                                                                        input=""
                                                                        onChangeFunction={() => {}}
                                                                        error={
                                                                            form.formState.errors
                                                                                .join_link?.message
                                                                        }
                                                                        size="large"
                                                                        disabled
                                                                        className="!min-w-full"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                <div className="mb-6 flex justify-center">
                                                    <MyButton
                                                        type="button"
                                                        scale="medium"
                                                        buttonType="primary"
                                                        className="mt-4 w-fit"
                                                        disable
                                                    >
                                                        Register Now
                                                    </MyButton>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            )}
                        </>
                    )}
                    <AddingParticipantsTab
                        batches={transformedBatches}
                        form={form}
                        totalBatches={transformBatchData(
                            batches_for_sessions || [],
                            selectedSection!
                        )}
                        selectedSection={selectedSection ?? ''}
                        setSelectedSection={setSelectedSection}
                        sectionsInfo={sectionsInfo}
                    />
                    {/* Display validation errors for participant selection */}
                    {form.formState.errors.select_individually?.student_details?.message && (
                        <div className="text-sm text-red-600 mt-2" data-error="true">
                            {form.formState.errors.select_individually.student_details.message}
                        </div>
                    )}
                    {form.formState.errors.select_batch?.batch_details?.message && (
                        <div className="text-sm text-red-600 mt-2" data-error="true">
                            {String(form.formState.errors.select_batch.batch_details.message)}
                        </div>
                    )}
                    <Separator className="my-4" />
                    <div className="flex items-center justify-between" id="join-link-qr-code">
                        <div className="flex flex-col gap-2">
                            <h1>Join Link</h1>
                            <div className="flex items-center gap-8">
                                <div className="flex items-center gap-4">
                                    <FormField
                                        control={control}
                                        name="join_link"
                                        render={({ field: { ...field } }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <MyInput
                                                        inputType="text"
                                                        inputPlaceholder="Join Link"
                                                        input={field.value}
                                                        onChangeFunction={field.onChange}
                                                        error={
                                                            form.formState.errors.join_link?.message
                                                        }
                                                        size="large"
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <MyButton
                                        type="button"
                                        scale="small"
                                        buttonType="secondary"
                                        className="h-10 min-w-10"
                                        onClick={() => copyToClipboard(getValues('join_link'))}
                                    >
                                        <Copy size={32} />
                                    </MyButton>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <h1>QR Code</h1>
                            <div className="flex items-center gap-8">
                                <div className="flex items-center gap-4">
                                    <FormField
                                        control={control}
                                        name="join_link"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <QRCode
                                                        value={field.value ?? ''}
                                                        className="size-16"
                                                        id="qr-code-svg"
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <MyButton
                                        type="button"
                                        scale="small"
                                        buttonType="secondary"
                                        className="h-10 min-w-10"
                                        onClick={() => handleDownloadQRCode('qr-code-svg')}
                                    >
                                        <DownloadSimple size={32} />
                                    </MyButton>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Separator className="my-4" />
                    {/* will be added later
                    <FormField
                        control={form.control}
                        name="show_leaderboard"
                        render={({ field }) => (
                            <FormItem className="my-2 flex w-1/2 items-center justify-between">
                                <FormLabel>Show Leaderboard to Participants</FormLabel>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    /> */}
                    <div className="flex w-3/4 justify-between" id="notify-via-email">
                        {getStepKey({
                            assessmentDetails,
                            currentStep,
                            key: 'notify_participants',
                        }) === 'REQUIRED' && (
                            <div className="flex flex-col gap-4">
                                <h1>Notify Participants via Email:</h1>
                                <FormField
                                    control={control}
                                    name={`notify_student.when_assessment_created`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-end gap-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    className={`size-5 rounded-sm border-2 shadow-none ${
                                                        field.value
                                                            ? 'border-none bg-primary-500 text-white' // Blue background and red tick when checked
                                                            : '' // Default styles when unchecked
                                                    }`}
                                                />
                                            </FormControl>
                                            <FormLabel className="!mb-[3px] font-thin">
                                                {examType === 'SURVEY' ? 'When Survey is created' : 'When Assessment is created'}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name={`notify_student.before_assessment_goes_live.checked`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-end gap-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    className={`size-5 rounded-sm border-2 shadow-none ${
                                                        field.value
                                                            ? 'border-none bg-primary-500 text-white' // Blue background and red tick when checked
                                                            : '' // Default styles when unchecked
                                                    }`}
                                                />
                                            </FormControl>
                                            <FormLabel className="!mb-[3px] font-thin">
                                                {examType === 'SURVEY' ? 'Before Survey goes live' : 'Before Assessment goes live'}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                                {watch('notify_student.before_assessment_goes_live')?.checked && (
                                    <SelectField
                                        label="Notify Before"
                                        labelStyle="font-thin"
                                        name="notify_student.before_assessment_goes_live.value"
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
                                <FormField
                                    control={control}
                                    name={`notify_student.when_assessment_live`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-end gap-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    className={`size-5 rounded-sm border-2 shadow-none ${
                                                        field.value
                                                            ? 'border-none bg-primary-500 text-white' // Blue background and red tick when checked
                                                            : '' // Default styles when unchecked
                                                    }`}
                                                />
                                            </FormControl>
                                            <FormLabel className="!mb-[3px] font-thin">
                                                {examType === 'SURVEY' ? 'When Survey goes live' : 'When Assessment goes live'}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name={`notify_student.when_assessment_report_generated`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-end gap-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    className={`size-5 rounded-sm border-2 shadow-none ${
                                                        field.value
                                                            ? 'border-none bg-primary-500 text-white' // Blue background and red tick when checked
                                                            : '' // Default styles when unchecked
                                                    }`}
                                                />
                                            </FormControl>
                                            <FormLabel className="!mb-[3px] font-thin">
                                                {examType === 'SURVEY' ? 'When survey reports are generated' : 'When assessment reports are generated'}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                        {/* Notify Participants via Email */}
                        {(examType === 'SURVEY' || getStepKey({
                            assessmentDetails,
                            currentStep,
                            key: "notify_parents",
                        }) === "REQUIRED") && (
                            <div className="flex flex-col gap-4">
                                <h1>{examType === 'SURVEY' ? 'Notify Participants via Email:' : 'Notify Parents via Email:'}</h1>
                                <FormField
                                    control={control}
                                    name={`notify_parent.when_assessment_created`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-end gap-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    className={`size-5 rounded-sm border-2 shadow-none ${
                                                        field.value
                                                            ? "border-none bg-primary-500 text-white" // Blue background and red tick when checked
                                                            : "" // Default styles when unchecked
                                                    }`}
                                                />
                                            </FormControl>
                                            <FormLabel className="!mb-[3px] font-thin">
                                                {examType === 'SURVEY' ? 'When Survey is created' : 'When Assessment is created'}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name={`notify_parent.before_assessment_goes_live.checked`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-end gap-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    className={`size-5 rounded-sm border-2 shadow-none ${
                                                        field.value
                                                            ? "border-none bg-primary-500 text-white" // Blue background and red tick when checked
                                                            : "" // Default styles when unchecked
                                                    }`}
                                                />
                                            </FormControl>
                                            <FormLabel className="!mb-[3px] font-thin">
                                                {examType === 'SURVEY' ? 'Before Survey goes live' : 'Before Assessment goes live'}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                                {watch("notify_parent.before_assessment_goes_live").checked && (
                                    <SelectField
                                        label="Notify Before"
                                        labelStyle="font-thin"
                                        name="notify_parent.before_assessment_goes_live.value"
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
                                <FormField
                                    control={control}
                                    name={`notify_parent.when_assessment_live`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-end gap-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    className={`size-5 rounded-sm border-2 shadow-none ${
                                                        field.value
                                                            ? "border-none bg-primary-500 text-white" // Blue background and red tick when checked
                                                            : "" // Default styles when unchecked
                                                    }`}
                                                />
                                            </FormControl>
                                            <FormLabel className="!mb-[3px] font-thin">
                                                {examType === 'SURVEY' ? 'When Survey goes live' : 'When Assessment goes live'}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name={`notify_parent.when_student_appears`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-end gap-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    className={`size-5 rounded-sm border-2 shadow-none ${
                                                        field.value
                                                            ? "border-none bg-primary-500 text-white" // Blue background and red tick when checked
                                                            : "" // Default styles when unchecked
                                                    }`}
                                                />
                                            </FormControl>
                                            <FormLabel className="!mb-[3px] font-thin">
                                                {examType === 'SURVEY' ? 'When students appears for the Survey' : 'When students appears for the Assessment'}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name={`notify_parent.when_student_finishes_test`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-end gap-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    className={`size-5 rounded-sm border-2 shadow-none ${
                                                        field.value
                                                            ? "border-none bg-primary-500 text-white" // Blue background and red tick when checked
                                                            : "" // Default styles when unchecked
                                                    }`}
                                                />
                                            </FormControl>
                                            <FormLabel className="!mb-[3px] font-thin">
                                                {examType === 'SURVEY' ? 'When students finishes the Survey' : 'When students finishes the Assessment'}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name={`notify_parent.when_assessment_report_generated`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-end gap-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    className={`size-5 rounded-sm border-2 shadow-none ${
                                                        field.value
                                                            ? "border-none bg-primary-500 text-white" // Blue background and red tick when checked
                                                            : "" // Default styles when unchecked
                                                    }`}
                                                />
                                            </FormControl>
                                            <FormLabel className="!mb-[3px] font-thin">
                                                {examType === 'SURVEY' ? 'When survey reports are generated' : 'When assessment reports are generated'}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </form>
        </FormProvider>
    );
};

export default Step3AddingParticipants;
