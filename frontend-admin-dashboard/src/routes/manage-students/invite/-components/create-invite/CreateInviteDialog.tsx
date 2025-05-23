import { MyDialog } from '@/components/design-system/dialog';
import { MyInput } from '@/components/design-system/input';
import { Switch } from '@/components/ui/switch';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { FormProvider } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { InviteForm } from '../../-schema/InviteFormSchema';
import { useInviteForm } from '../../-hooks/useInviteForm';
import { CustomFieldsSection } from './CustomFieldsSection';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { Checkbox } from '@/components/ui/checkbox';
import useIntroJsTour from '@/hooks/use-intro';
import { IntroKey } from '@/constants/storage/introKey';
import { inviteSteps } from '@/constants/intro/steps';
import { AddCourseButton } from '@/components/common/study-library/add-course/add-course-button';
import { useAddCourse } from '@/services/study-library/course-operations/add-course';
import { AddCourseData } from '@/components/common/study-library/add-course/add-course-form';
import { Plus } from 'phosphor-react';

interface CreateInviteDialogProps {
    initialValues?: InviteForm;
    triggerButton?: JSX.Element;
    submitButton: JSX.Element;
    open?: boolean;
    onOpenChange?: () => void;
    submitForm?: (fn: () => void) => void;
    onCreateInvite?: (invite: InviteForm) => void;
    inviteLink?: string | null;
    setInviteLink?: Dispatch<SetStateAction<string | null>>;
    isEditing?: boolean;
    handleDisableCreateInviteButton?: (value: boolean) => void;
}

// Define a type for email entries
interface EmailEntry {
    id: string;
    value: string;
}

export const CreateInviteDialog = ({
    initialValues,
    triggerButton,
    submitButton,
    open,
    onOpenChange,
    submitForm,
    onCreateInvite,
    isEditing,
    handleDisableCreateInviteButton,
}: CreateInviteDialogProps) => {
    const { form, toggleIsRequired, handleAddOpenFieldValues, handleDeleteOpenField } =
        useInviteForm(initialValues);
    const addCourseMutation = useAddCourse();

    const {
        control,
        reset,
        getValues,
        setValue,
        watch,
        formState: { errors },
    } = form;
    const [emailError, setEmailError] = useState<string | null>(null);
    const emptyEmailsError = errors.inviteeEmails?.message;

    // Watch the email input to validate in real-time
    const emailInput = watch('inviteeEmail');
    // Watch the email list to ensure UI updates
    const emailList = watch('inviteeEmails') || [];

    // Validate email format in real-time
    useEffect(() => {
        if (!emailInput) {
            setEmailError(null);
            return;
        }

        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput);
        if (!isValidEmail) {
            setEmailError('Please enter a valid email address');
        } else {
            setEmailError(null);
        }
    }, [emailInput]);

    // Function to generate a unique ID
    const generateId = () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    };

    // Function to handle adding an email
    const handleAddEmail = () => {
        const email = getValues('inviteeEmail');

        // Validate email format
        if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            setEmailError('Please enter a valid email address');
            return;
        }

        // Check if email already exists
        const currentEmails = getValues('inviteeEmails') || [];
        if (currentEmails.some((entry: EmailEntry) => entry.value === email)) {
            setEmailError('This email has already been added');
            return;
        }

        // Add email to the array with a unique ID
        const newEmail: EmailEntry = {
            id: generateId(),
            value: email,
        };

        setValue('inviteeEmails', [...currentEmails, newEmail]);

        // Clear input and error
        setValue('inviteeEmail', '');
        setEmailError(null);
    };

    // Function to remove an email by ID
    const handleRemoveEmail = (idToRemove: string) => {
        const currentEmails = getValues('inviteeEmails') || [];
        setValue(
            'inviteeEmails',
            currentEmails.filter((entry: EmailEntry) => entry.id !== idToRemove)
        );
    };

    const handleAddCourse = ({ requestData }: { requestData: AddCourseData }) => {
        addCourseMutation.mutate(
            { requestData: requestData },
            {
                onSuccess: () => {
                    toast.success('Batch created successfully');
                },
                onError: () => {
                    toast.error('Failed to create batch');
                },
            }
        );
    };

    useEffect(() => {
        if (open && initialValues) {
            reset(initialValues);
        }
    }, [open, initialValues, reset]);

    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (submitForm) {
            submitForm(() => {
                if (formRef.current) {
                    formRef.current.requestSubmit();
                }
            });
        }
    }, [submitForm]);

    const { instituteDetails } = useInstituteDetailsStore();
    const courseSelectionMode = watch('batches.courseSelectionMode');

    useEffect(() => {
        if (handleDisableCreateInviteButton) {
            if (
                watch('batches.preSelectedCourses').length === 0 &&
                watch('batches.learnerChoiceCourses').length === 0
            ) {
                handleDisableCreateInviteButton(true);
            } else {
                handleDisableCreateInviteButton(false);
            }
        }
    }, [watch('batches.preSelectedCourses'), watch('batches.learnerChoiceCourses')]);

    useEffect(() => {
        const len = watch('batches.learnerChoiceCourses').length;
        const maxValue = watch('batches.maxCourses');
        if (maxValue > len) setValue('batches.maxCourses', len);
    }, [watch('batches.learnerChoiceCourses').length]);

    useIntroJsTour({
        key: IntroKey.inviteFirstTimeVisit,
        steps: inviteSteps,
        enable: open,
    });
    return (
        <MyDialog
            heading="Invite Learner"
            footer={submitButton}
            trigger={triggerButton}
            dialogWidth="w-[60vw]"
            open={open}
            isTour={true}
            onOpenChange={onOpenChange}
        >
            <FormProvider {...form}>
                <form
                    ref={formRef}
                    onSubmit={form.handleSubmit((data: InviteForm) => {
                        try {
                            onCreateInvite && onCreateInvite(data);
                            // Other success handling
                            form.reset();
                        } catch {
                            toast.error('error updating/creating invite');
                        }
                    })}
                >
                    <div className="flex flex-col gap-10 text-neutral-600">
                        {/* Invite Link & Active Status */}
                        <div className="flex justify-between gap-4">
                            <FormField
                                control={control}
                                name="inviteLink"
                                render={({ field }) => (
                                    <FormItem className="w-4/5">
                                        <FormControl>
                                            <MyInput
                                                id="invite-link-name"
                                                label="Invite Link Name"
                                                required={true}
                                                inputType="text"
                                                inputPlaceholder="Enter invite link name"
                                                input={field.value}
                                                onChangeFunction={field.onChange}
                                                className="w-full"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <div className="flex w-fit gap-2" id="activate-link">
                                <p className="text-subtitle font-semibold">Active Status</p>
                                <FormField
                                    control={control}
                                    name="activeStatus"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Custom Fields Section */}
                        <div id="custom-fields">
                            <CustomFieldsSection
                                toggleIsRequired={toggleIsRequired}
                                handleAddOpenFieldValues={handleAddOpenFieldValues}
                                handleDeleteOpenField={handleDeleteOpenField}
                            />
                        </div>

                        {/* <CourseList /> */}
                        {instituteDetails?.batches_for_sessions.length == 0 ? (
                            <div className="flex flex-col gap-3" id="select-batch">
                                <p className="text-subtitle font-semibold">
                                    Batch Selection<span className="text-danger-600">*</span>
                                </p>
                                <AddCourseButton
                                    onSubmit={handleAddCourse}
                                    courseButton={
                                        <MyButton
                                            type="button"
                                            buttonType="text"
                                            layoutVariant="default"
                                            scale="small"
                                            className="w-fit text-primary-500 hover:bg-white active:bg-white"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                            }}
                                        >
                                            <Plus /> Create Batch
                                        </MyButton>
                                    }
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3" id="select-batch">
                                <p className="text-subtitle font-semibold">
                                    Batch Selection<span className="text-danger-600">*</span>
                                </p>
                                <FormField
                                    control={form.control}
                                    name="batches.courseSelectionMode"
                                    render={({ field }) => (
                                        <FormItem className={`flex flex-col gap-2 space-y-2`}>
                                            <FormControl>
                                                <RadioGroup
                                                    value={
                                                        field.value === 'institute'
                                                            ? 'institute'
                                                            : 'student'
                                                    }
                                                    onValueChange={(value) => {
                                                        // Set the proper enum value
                                                        form.setValue(
                                                            'batches.courseSelectionMode',
                                                            value as 'institute' | 'student'
                                                        );

                                                        // Clear the appropriate arrays
                                                        if (value === 'institute') {
                                                            form.setValue(
                                                                'batches.learnerChoiceCourses',
                                                                []
                                                            );
                                                            form.setValue('batches.maxCourses', 0);
                                                        } else {
                                                            form.setValue(
                                                                'batches.preSelectedCourses',
                                                                []
                                                            );
                                                        }

                                                        field.onChange(value);
                                                    }}
                                                    className="flex items-center gap-8"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="institute" />
                                                        <label
                                                            htmlFor="contain_levels_true"
                                                            className="text-subtitle text-neutral-600"
                                                        >
                                                            I want to assign batches
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="student" />
                                                        <label
                                                            htmlFor="contain_levels_false"
                                                            className="text-subtitle text-neutral-600"
                                                        >
                                                            I want students to choose batches
                                                        </label>
                                                    </div>
                                                </RadioGroup>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <div className="ml-3">
                                    {courseSelectionMode === 'institute' ? (
                                        <div className="grid grid-cols-3 gap-1 text-caption">
                                            {instituteDetails?.batches_for_sessions.map((batch) => (
                                                <FormField
                                                    key={batch.id}
                                                    control={control}
                                                    name="batches.preSelectedCourses"
                                                    render={({ field }) => {
                                                        return (
                                                            <FormItem key={batch.id}>
                                                                <FormControl>
                                                                    <div className="flex items-center gap-2">
                                                                        <Checkbox
                                                                            className="data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                                                                            checked={field.value?.some(
                                                                                (item) =>
                                                                                    item.id ===
                                                                                    batch.id
                                                                            )}
                                                                            onCheckedChange={(
                                                                                checked
                                                                            ) => {
                                                                                const newValue =
                                                                                    checked
                                                                                        ? [
                                                                                              ...field.value,
                                                                                              batch,
                                                                                          ]
                                                                                        : field.value.filter(
                                                                                              (b) =>
                                                                                                  b.id !==
                                                                                                  batch.id
                                                                                          );
                                                                                // form.setValue("batches.preSelectedCourses", newValue);
                                                                                field.onChange(
                                                                                    newValue
                                                                                );
                                                                            }}
                                                                        />
                                                                        <label className="text-wrap text-neutral-600">
                                                                            {batch.level.level_name}{' '}
                                                                            {
                                                                                batch.package_dto
                                                                                    .package_name
                                                                            }{' '}
                                                                            {
                                                                                batch.session
                                                                                    .session_name
                                                                            }{' '}
                                                                        </label>
                                                                    </div>
                                                                </FormControl>
                                                            </FormItem>
                                                        );
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2 text-caption">
                                            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                                                {instituteDetails?.batches_for_sessions.map(
                                                    (batch) => (
                                                        <FormField
                                                            key={batch.id}
                                                            control={control}
                                                            name="batches.learnerChoiceCourses"
                                                            render={({ field }) => {
                                                                return (
                                                                    <FormItem key={batch.id}>
                                                                        <FormControl>
                                                                            <div className="flex items-center gap-2">
                                                                                <Checkbox
                                                                                    className="data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                                                                                    checked={field.value?.some(
                                                                                        (item) =>
                                                                                            item.id ===
                                                                                            batch.id
                                                                                    )}
                                                                                    onCheckedChange={(
                                                                                        checked
                                                                                    ) => {
                                                                                        const newValue =
                                                                                            checked
                                                                                                ? [
                                                                                                      ...field.value,
                                                                                                      batch,
                                                                                                  ]
                                                                                                : field.value.filter(
                                                                                                      (
                                                                                                          b
                                                                                                      ) =>
                                                                                                          b.id !==
                                                                                                          batch.id
                                                                                                  );
                                                                                        // form.setValue("batches.learnerChoiceCourses", newValue);
                                                                                        field.onChange(
                                                                                            newValue
                                                                                        );
                                                                                    }}
                                                                                />
                                                                                <label className="text-wrap text-neutral-600">
                                                                                    {
                                                                                        batch.level
                                                                                            .level_name
                                                                                    }{' '}
                                                                                    {
                                                                                        batch
                                                                                            .package_dto
                                                                                            .package_name
                                                                                    }{' '}
                                                                                    {
                                                                                        batch
                                                                                            .session
                                                                                            .session_name
                                                                                    }{' '}
                                                                                </label>
                                                                            </div>
                                                                        </FormControl>
                                                                    </FormItem>
                                                                );
                                                            }}
                                                        />
                                                    )
                                                )}
                                            </div>

                                            {getValues('batches.learnerChoiceCourses').length >
                                                0 && (
                                                <FormField
                                                    control={control}
                                                    name="batches.maxCourses"
                                                    render={({ field }) => {
                                                        return (
                                                            <FormItem>
                                                                <FormControl>
                                                                    <div className="flex items-center gap-2">
                                                                        <label className="text-body">
                                                                            Enter max number of
                                                                            batches a student can
                                                                            select
                                                                        </label>
                                                                        <input
                                                                            type="number"
                                                                            value={field.value || 1}
                                                                            onChange={(e) => {
                                                                                const learnerChoiceNumber =
                                                                                    getValues(
                                                                                        'batches.learnerChoiceCourses'
                                                                                    ).length;
                                                                                const numValue =
                                                                                    parseInt(
                                                                                        e.target
                                                                                            .value
                                                                                    ) || 1;
                                                                                const value =
                                                                                    numValue <= 0
                                                                                        ? 1
                                                                                        : numValue >
                                                                                            learnerChoiceNumber
                                                                                          ? learnerChoiceNumber
                                                                                          : numValue;
                                                                                field.onChange(
                                                                                    value
                                                                                );
                                                                            }}
                                                                            className="w-[50px] rounded-lg border border-neutral-300 px-2 py-1"
                                                                        />
                                                                    </div>
                                                                </FormControl>
                                                            </FormItem>
                                                        );
                                                    }}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Student Expiry Date */}
                        <div className="flex items-center gap-6" id="student-access-duration">
                            <p className="text-subtitle font-semibold">Student expiry date</p>
                            <div className="flex items-center gap-2">
                                <FormField
                                    control={control}
                                    name="studentExpiryDays"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <MyInput
                                                    input={field.value?.toString() || ''}
                                                    inputType="number"
                                                    onChangeFunction={(e) =>
                                                        field.onChange(
                                                            parseInt(e.target.value) || 0
                                                        )
                                                    }
                                                    className="w-[70px]"
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <p>days</p>
                            </div>
                        </div>

                        {/* Invitee Email */}
                        {!isEditing && (
                            <div className="flex flex-col gap-3" id="invitee-email">
                                <div className="flex items-end justify-between gap-10">
                                    <FormField
                                        control={control}
                                        name="inviteeEmail"
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <p>Enter invitee email</p>
                                                <FormControl>
                                                    <MyInput
                                                        placeholder="you@email.com"
                                                        inputType="email"
                                                        input={field.value || ''}
                                                        onChangeFunction={field.onChange}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddEmail();
                                                            }
                                                        }}
                                                        className="w-full"
                                                        // required={true}
                                                        error={
                                                            emailError ||
                                                            (emailList.length === 0
                                                                ? emptyEmailsError
                                                                : undefined)
                                                        }
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <MyButton
                                        buttonType="secondary"
                                        scale="large"
                                        layoutVariant="default"
                                        type="button"
                                        onClick={handleAddEmail}
                                        disabled={!!emailError || !emailInput}
                                        className={`${
                                            emailError || emptyEmailsError ? 'mb-7' : 'mb-0'
                                        }`}
                                    >
                                        Add
                                    </MyButton>
                                </div>

                                {/* Display added emails */}
                                <div className="flex flex-wrap gap-2">
                                    {emailList?.map((entry: EmailEntry) => (
                                        <div
                                            key={entry.id}
                                            className="text-primary-700 flex items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-3"
                                        >
                                            <span>{entry.value}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveEmail(entry.id)}
                                                className="hover:text-primary-700 text-primary-500"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* {inviteLink && inviteLink != null && (
                            <div className="flex flex-col gap-10">
                                <Separator />
                                <div className="flex w-fit items-center gap-4">
                                    <p className="w-[50%] overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-neutral-300 p-2 text-neutral-500">
                                        {inviteLink}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <MyButton
                                            buttonType="secondary"
                                            scale="medium"
                                            layoutVariant="icon"
                                            onClick={() => handleCopyClick(inviteLink)}
                                            type="button"
                                        >
                                            <Copy />
                                        </MyButton>
                                        {copySuccess === inviteLink && (
                                            <span className="text-caption text-primary-500">
                                                Copied!
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )} */}
                    </div>
                </form>
            </FormProvider>
        </MyDialog>
    );
};
