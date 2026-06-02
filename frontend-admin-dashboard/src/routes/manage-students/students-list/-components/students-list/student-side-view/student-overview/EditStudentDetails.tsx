import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyDropdown } from '@/components/common/students/enroll-manually/dropdownForPackageItems';
import { MyInput } from '@/components/design-system/input';
import PhoneInputField from '@/components/design-system/phone-input-field';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import { useEffect, useRef, useState, useMemo } from 'react';
import EnrollFormUploadImage from '@/assets/svgs/enroll-form-upload-image.svg';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { useFileUpload } from '@/hooks/use-file-upload';

import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useEditStudentDetails } from '@/routes/manage-students/students-list/-services/editStudentDetails';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { useGetStudentDetails } from '@/services/get-student-details';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { DropdownValueType } from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { PencilSimple, Upload, Trash } from '@phosphor-icons/react';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import {
    getCustomFieldSettingsFromCache,
    type CustomField,
    type FieldGroup,
} from '@/services/custom-field-settings';
import { getFieldsForLocation } from '@/lib/custom-fields/utils';

const EditStudentDetailsFormSchema = z.object({
    user_id: z.string().min(1, 'This field is required'),
    username: z.string().optional(),
    email: z.string().email('Invalid email address'),
    full_name: z.string().min(1, 'This field is required'),
    contact_number: z.string().min(1, 'This field is required'),
    gender: z.string().min(1, 'This field is required'),
    date_of_birth: z.string().optional(),
    address_line: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    pin_code: z.string().optional(),
    institute_name: z.string().optional(),
    fathers_name: z.string().optional(),
    mothers_name: z.string().optional(),
    father_mobile_number: z.string().optional(),
    father_email: z.string().email('Invalid email').optional().or(z.literal('')),
    mother_mobile_number: z.string().optional(),
    mother_email: z.string().email('Invalid email').optional().or(z.literal('')),
    face_file_id: z.string().optional().or(z.literal('')),
    custom_fields: z.record(z.string()).optional(),
});

export type EditStudentDetailsFormValues = z.infer<typeof EditStudentDetailsFormSchema>;

export const EditStudentDetails = () => {
    const { selectedStudent, setSelectedStudent } = useStudentSidebar();
    const { data: studentDetails } = useGetStudentDetails(selectedStudent?.user_id || '');
    const form = useForm<EditStudentDetailsFormValues>({
        resolver: zodResolver(EditStudentDetailsFormSchema),
        defaultValues: {},
    });

    const { setValue } = form;
    const { instituteDetails } = useInstituteDetailsStore();
    const genderList: DropdownValueType[] =
        instituteDetails?.genders.map((gender) => ({ id: crypto.randomUUID(), name: gender })) ||
        [];

    const INSTITUTE_ID = getCurrentInstituteId();

    const [faceUrl, setFaceUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { uploadFile, getPublicUrl } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [removedImage, setRemovedImage] = useState(false); // 🆕 new state for tracking unsaved removal

    // Fetch custom fields for both Learner List and Learner Enrollment locations
    const customFieldsData = useMemo(() => {
        const learnerListFields = getFieldsForLocation("Learner's List");
        const learnerEnrollmentFields = getFieldsForLocation("Learner's Enrollment");

        // Merge and deduplicate by field ID
        const allFieldsMap = new Map();
        [...learnerListFields, ...learnerEnrollmentFields].forEach((field) => {
            allFieldsMap.set(field.id, field);
        });
        const customFields = Array.from(allFieldsMap.values());

        // Get the full settings to access groups
        const settings = getCustomFieldSettingsFromCache();

        if (!settings) {
            return { customFields, fieldGroups: [], individualFields: customFields };
        }

        // Get visibility keys for both locations
        const visibilityKeys = ['learnerList', 'learnerEnrollment'];

        // Filter groups that have at least one field visible in either location
        const visibleGroups = settings.fieldGroups.filter((group) => {
            return group.fields.some((field) =>
                visibilityKeys.some((key) => field.visibility[key as keyof typeof field.visibility])
            );
        });

        // For each visible group, filter to only include fields visible in either location
        const filteredGroups = visibleGroups.map((group) => ({
            ...group,
            fields: group.fields.filter((field) =>
                visibilityKeys.some((key) => field.visibility[key as keyof typeof field.visibility])
            ),
        }));

        // Get field IDs that are in groups
        const fieldIdsInGroups = new Set(
            filteredGroups.flatMap((group) => group.fields.map((f) => f.id))
        );

        // Filter out fields that are already in groups
        const individualFields = customFields.filter((field) => !fieldIdsInGroups.has(field.id));

        return { customFields, fieldGroups: filteredGroups, individualFields };
    }, []);

    const loadImage = async (fileId: string) => {
        if (fileId) {
            const url = await getPublicUrl(fileId);
            setFaceUrl(url || '');
        }
    };

    useEffect(() => {
        if (selectedStudent && openDialog) {
            // Prefer API-fetched details over list-row data
            const s = studentDetails || selectedStudent;

            // Prepare custom fields object
            const customFieldsValues: Record<string, string> = {};
            const customFieldsSource = s.custom_fields || selectedStudent.custom_fields;
            if (customFieldsSource) {
                Object.entries(customFieldsSource).forEach(([key, value]) => {
                    if (value !== null && value !== undefined) {
                        customFieldsValues[key] = value as string;
                    }
                });
            }

            form.reset({
                user_id: selectedStudent.user_id || '',
                username: s.username || selectedStudent.username || '',
                email: s.email || selectedStudent.email || '',
                full_name: s.full_name || selectedStudent.full_name || '',
                contact_number: s.mobile_number || selectedStudent.mobile_number || '',
                gender: s.gender || selectedStudent.gender || '',
                date_of_birth: s.date_of_birth || selectedStudent.date_of_birth || '',
                address_line: s.address_line || selectedStudent.address_line || '',
                city: s.city || selectedStudent.city || '',
                state: s.region || selectedStudent.region || '',
                pin_code: s.pin_code || selectedStudent.pin_code || '',
                institute_name: s.linked_institute_name || selectedStudent.linked_institute_name || '',
                fathers_name: s.fathers_name || selectedStudent.fathers_name || '',
                mothers_name: s.mothers_name || selectedStudent.mothers_name || '',
                father_mobile_number:
                    s.parents_mobile_number ||
                    selectedStudent.parents_mobile_number ||
                    selectedStudent.father_mobile_number ||
                    '',
                father_email:
                    s.parents_email ||
                    selectedStudent.parents_email ||
                    selectedStudent.father_email ||
                    '',
                mother_mobile_number:
                    s.parents_to_mother_mobile_number ||
                    selectedStudent.parents_to_mother_mobile_number ||
                    selectedStudent.mother_mobile_number ||
                    '',
                mother_email:
                    s.parents_to_mother_email ||
                    selectedStudent.parents_to_mother_email ||
                    selectedStudent.mother_email ||
                    '',
                face_file_id: s.face_file_id || selectedStudent.face_file_id || '',
                custom_fields: customFieldsValues,
            });

            const faceFileId = s.face_file_id || selectedStudent.face_file_id;
            if (faceFileId && !removedImage) {
                loadImage(faceFileId);
            } else {
                setFaceUrl(null); // fallback if image was removed
            }

            setRemovedImage(false); // reset on open
        }
    }, [selectedStudent, openDialog, studentDetails]);

    const handleFileSubmit = async (file: File) => {
        setIsUploading(true);
        const fileId = await uploadFile({
            file,
            setIsUploading,
            userId: selectedStudent?.user_id || '',
            source: INSTITUTE_ID || '',
            sourceId: 'STUDENTS',
        });

        if (fileId) {
            await loadImage(fileId);
            setValue('face_file_id', fileId);
        }

        setIsUploading(false);
    };

    const handleRemoveImage = () => {
        setFaceUrl(null);
        setValue('face_file_id', '');
        setRemovedImage(true); // 🆕 flag to remember removal
    };

    const handleDialogChange = (isOpen: boolean) => {
        setOpenDialog(isOpen);
    };

    const editStudentDetailsMutation = useEditStudentDetails();
    const onSubmit = async (values: EditStudentDetailsFormValues) => {
        try {
            const face_file_id = form.getValues('face_file_id') ?? '';

            const payload = { ...values, face_file_id };

            await editStudentDetailsMutation.mutateAsync(payload);

            if (selectedStudent) {
                const updatedStudent = {
                    ...selectedStudent,
                    ...payload,
                    id: selectedStudent.id,
                    mobile_number: payload.contact_number,
                    region: payload.state ?? null,
                    linked_institute_name: payload.institute_name ?? null,
                    face_file_id: payload.face_file_id ?? '', // Ensure it's a string
                };

                setSelectedStudent(updatedStudent);
            }

            if (face_file_id) {
                const newFaceUrl = await getPublicUrl(face_file_id);
                setFaceUrl(newFaceUrl || '');
            } else {
                setFaceUrl(null); // if image was removed
            }

            setOpenDialog(false);
        } catch (err) {
            console.error('Failed to update student:', err);
        }
    };

    const submitButton = (
        <MyButton
            onAsyncClick={async () => {
                // Trigger form validation and submission
                const isValid = await form.trigger();
                if (isValid) {
                    await form.handleSubmit(onSubmit)();
                }
            }}
            loadingText="Saving..."
        >
            Save Changes
        </MyButton>
    );

    return selectedStudent ? (
        <MyDialog
            trigger={
                <MyButton buttonType="secondary" scale="medium">
                    <PencilSimple className="size-4" />
                    Edit Details
                </MyButton>
            }
            footer={submitButton}
            heading={`Edit ${getTerminology(RoleTerms.Learner, SystemTerms.Learner)} Details`}
            open={openDialog}
            onOpenChange={handleDialogChange}
            dialogWidth="max-w-2xl"
        >
            <FormProvider {...form}>
                <form
                    ref={formRef}
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex w-full flex-col gap-6"
                >
                    {/* Profile photo — compact avatar + actions */}
                    <div className="flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4">
                        {isUploading ? (
                            <DashboardLoader />
                        ) : (
                            <div className="shrink-0">
                                {faceUrl ? (
                                    <img
                                        src={faceUrl}
                                        alt="Profile"
                                        className="size-24 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex size-24 items-center justify-center rounded-full bg-muted">
                                        <EnrollFormUploadImage />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-subtitle font-semibold text-card-foreground">
                                Profile photo
                            </span>
                            <span className="text-caption text-muted-foreground">
                                Square image, at least 200×200. Max 5 MB.
                            </span>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => fileInputRef.current?.click()}
                                    disable={isUploading}
                                >
                                    <Upload className="size-4" />
                                    {faceUrl ? 'Replace' : 'Upload'}
                                </MyButton>
                                {faceUrl && (
                                    <MyButton
                                        type="button"
                                        buttonType="text"
                                        scale="small"
                                        onClick={handleRemoveImage}
                                        disable={isUploading}
                                    >
                                        <Trash className="size-4" />
                                        Remove
                                    </MyButton>
                                )}
                            </div>
                        </div>

                        <FileUploadComponent
                            fileInputRef={fileInputRef}
                            onFileSubmit={handleFileSubmit}
                            control={form.control}
                            name="face_file_id"
                            acceptedFileTypes="image/*"
                        />
                    </div>

                    {/* Personal info ─────────────────────────────────────────────── */}
                    <section className="flex w-full flex-col gap-4">
                        <h3 className="text-subtitle font-semibold text-card-foreground">
                            Personal info
                        </h3>
                        <FormField
                            control={form.control}
                            name="full_name"
                            render={({ field }) => (
                                <FormItem className="w-full">
                                    <FormControl className="w-full">
                                        <MyInput
                                            input={field.value}
                                            onChangeFunction={(e) => field.onChange(e.target.value)}
                                            inputType="text"
                                            inputPlaceholder="Full Name"
                                            className="w-full"
                                            required={true}
                                            label="Full Name"
                                            error={form.formState.errors.full_name?.message}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormControl className="w-full">
                                            <MyInput
                                                input={field.value}
                                                onChangeFunction={(e) =>
                                                    field.onChange(e.target.value)
                                                }
                                                inputType="text"
                                                inputPlaceholder="Email"
                                                className="w-full"
                                                required={true}
                                                label="Email"
                                                error={form.formState.errors.email?.message}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="contact_number"
                                render={() => (
                                    <FormItem className="w-full">
                                        <FormControl>
                                            <div className="flex flex-col gap-1">
                                                <PhoneInputField
                                                    label="Mobile Number"
                                                    placeholder="123 456 7890"
                                                    name="contact_number"
                                                    control={form.control}
                                                    required={true}
                                                />
                                                <p className="text-caption text-danger-600">
                                                    {form.formState.errors.contact_number?.message}
                                                </p>
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="gender"
                            render={({ field }) => {
                            const selectedGender = field.value
                                ? genderList.find(
                                      (g) =>
                                          (typeof g === 'object' &&
                                              'name' in g &&
                                              g.name === field.value) ||
                                          g === field.value
                                  )
                                : undefined;

                            return (
                                <FormItem className="w-full">
                                    <FormControl>
                                        <div className="flex flex-col gap-1">
                                            <div>
                                                Gender{' '}
                                                <span className="text-subtitle text-danger-600">
                                                    *
                                                </span>
                                            </div>
                                            <MyDropdown
                                                currentValue={selectedGender}
                                                dropdownList={genderList}
                                                handleChange={(value) => {
                                                    if (
                                                        typeof value === 'object' &&
                                                        'name' in value
                                                    ) {
                                                        field.onChange(value.name);
                                                    } else if (typeof value === 'string') {
                                                        field.onChange(value);
                                                    }
                                                }}
                                                placeholder="Select Gender"
                                                error={form.formState.errors.gender?.message}
                                                required={true}
                                            />
                                        </div>
                                    </FormControl>
                                </FormItem>
                            );
                        }}
                        />
                    </section>

                    {/* Address ───────────────────────────────────────────────────── */}
                    <section className="flex w-full flex-col gap-4">
                        <h3 className="text-subtitle font-semibold text-card-foreground">
                            Address
                        </h3>
                        <FormField
                            control={form.control}
                            name="address_line"
                            render={({ field }) => (
                                <FormItem className="w-full">
                                    <FormControl className="w-full">
                                        <MyInput
                                            input={field.value}
                                            onChangeFunction={(e) => field.onChange(e.target.value)}
                                            inputType="text"
                                            inputPlaceholder="Address Line"
                                            className="w-full"
                                            label="Address Line"
                                            error={form.formState.errors.address_line?.message}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
                            <FormField
                                control={form.control}
                                name="city"
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormControl className="w-full">
                                            <MyInput
                                                input={field.value}
                                                onChangeFunction={(e) =>
                                                    field.onChange(e.target.value)
                                                }
                                                inputType="text"
                                                inputPlaceholder="City"
                                                className="w-full"
                                                label="City"
                                                error={form.formState.errors.city?.message}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="state"
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormControl className="w-full">
                                            <MyInput
                                                input={field.value}
                                                onChangeFunction={(e) =>
                                                    field.onChange(e.target.value)
                                                }
                                                inputType="text"
                                                inputPlaceholder="State"
                                                className="w-full"
                                                label="State"
                                                error={form.formState.errors.state?.message}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="pin_code"
                                render={({ field: { onChange, value, ...field } }) => (
                                    <FormItem className="w-full">
                                        <FormControl className="w-full">
                                            <MyInput
                                                inputType="number"
                                                label="Pincode"
                                                inputPlaceholder="Eg. 425562"
                                                input={value}
                                                onChangeFunction={onChange}
                                                size="large"
                                                className="w-full"
                                                {...field}
                                                error={form.formState.errors.pin_code?.message}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </section>

                    {/* Institute ─────────────────────────────────────────────────── */}
                    <section className="flex w-full flex-col gap-4">
                        <h3 className="text-subtitle font-semibold text-card-foreground">
                            Institute
                        </h3>
                        <FormField
                            control={form.control}
                            name="institute_name"
                            render={({ field }) => (
                                <FormItem className="w-full">
                                    <FormControl className="w-full">
                                        <MyInput
                                            input={field.value}
                                            onChangeFunction={(e) => field.onChange(e.target.value)}
                                            inputType="text"
                                            inputPlaceholder="Institute Name"
                                            className="w-full"
                                            label="Institute Name"
                                            error={form.formState.errors.institute_name?.message}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </section>
                    {/* Father / Male Guardian ─────────────────────────────────── */}
                    <section className="flex w-full flex-col gap-4">
                        <h3 className="text-subtitle font-semibold text-card-foreground">
                            Father / Male Guardian
                        </h3>
                        <FormField
                            control={form.control}
                            name="fathers_name"
                            render={({ field }) => (
                                <FormItem className="w-full">
                                    <FormControl className="w-full">
                                        <MyInput
                                            input={field.value}
                                            onChangeFunction={(e) => field.onChange(e.target.value)}
                                            inputType="text"
                                            inputPlaceholder="Father/Male Guardian Name"
                                            className="w-full"
                                            label="Father/Male Guardian Name"
                                            error={form.formState.errors.fathers_name?.message}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="father_mobile_number"
                                render={() => (
                                    <FormItem className="w-full">
                                        <FormControl>
                                            <PhoneInputField
                                                label="Mobile Number"
                                                placeholder="123 456 7890"
                                                name="father_mobile_number"
                                                control={form.control}
                                                required={false}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="father_email"
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormControl className="w-full">
                                            <MyInput
                                                input={field.value}
                                                onChangeFunction={(e) =>
                                                    field.onChange(e.target.value)
                                                }
                                                inputType="email"
                                                inputPlaceholder="Email"
                                                className="w-full"
                                                label="Email"
                                                error={form.formState.errors.father_email?.message}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </section>

                    {/* Mother / Female Guardian ─────────────────────────────────── */}
                    <section className="flex w-full flex-col gap-4">
                        <h3 className="text-subtitle font-semibold text-card-foreground">
                            Mother / Female Guardian
                        </h3>
                        <FormField
                            control={form.control}
                            name="mothers_name"
                            render={({ field }) => (
                                <FormItem className="w-full">
                                    <FormControl className="w-full">
                                        <MyInput
                                            input={field.value}
                                            onChangeFunction={(e) => field.onChange(e.target.value)}
                                            inputType="text"
                                            inputPlaceholder="Mother/Female Guardian Name"
                                            className="w-full"
                                            label="Mother/Female Guardian Name"
                                            error={form.formState.errors.mothers_name?.message}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="mother_mobile_number"
                                render={() => (
                                    <FormItem className="w-full">
                                        <FormControl>
                                            <PhoneInputField
                                                label="Mobile Number"
                                                placeholder="123 456 7890"
                                                name="mother_mobile_number"
                                                control={form.control}
                                                required={false}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="mother_email"
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormControl className="w-full">
                                            <MyInput
                                                input={field.value}
                                                onChangeFunction={(e) =>
                                                    field.onChange(e.target.value)
                                                }
                                                inputType="email"
                                                inputPlaceholder="Email"
                                                className="w-full"
                                                label="Email"
                                                error={form.formState.errors.mother_email?.message}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </section>
                    {/* Custom Fields Section */}
                    {(customFieldsData.fieldGroups.length > 0 ||
                        customFieldsData.individualFields.length > 0) && (
                        <>
                            <div className="mt-6 w-full border-t pt-6">
                                <h3 className="text-h6 mb-4 font-semibold text-neutral-700">
                                    Additional Information
                                </h3>
                            </div>

                            {/* Field Groups */}
                            {customFieldsData.fieldGroups.map((group: FieldGroup) => (
                                <div key={group.id} className="mb-6 w-full">
                                    <h4 className="mb-3 text-sm font-semibold text-neutral-600">
                                        {group.name}
                                    </h4>
                                    <div className="flex w-full flex-col gap-4 border-l-2 border-neutral-200 pl-2">
                                        {group.fields.map((customField: CustomField) => {
                                            if (customField.type === 'dropdown') {
                                                const dropdownOptions =
                                                    customField.options?.map((option) => ({
                                                        id: option,
                                                        name: option,
                                                    })) || [];

                                                return (
                                                    <FormField
                                                        key={customField.id}
                                                        control={form.control}
                                                        name="custom_fields"
                                                        render={({ field }) => {
                                                            const currentValue =
                                                                field.value?.[customField.id];
                                                            const selectedOption = currentValue
                                                                ? {
                                                                      id: currentValue,
                                                                      name: currentValue,
                                                                  }
                                                                : undefined;

                                                            return (
                                                                <FormItem className="w-full">
                                                                    <FormControl>
                                                                        <div className="flex flex-col gap-1">
                                                                            <label className="text-sm font-medium">
                                                                                {customField.name}
                                                                                {customField.required && (
                                                                                    <span className="ml-1 text-danger-600">
                                                                                        *
                                                                                    </span>
                                                                                )}
                                                                            </label>
                                                                            <MyDropdown
                                                                                currentValue={
                                                                                    selectedOption
                                                                                }
                                                                                dropdownList={
                                                                                    dropdownOptions
                                                                                }
                                                                                handleChange={(
                                                                                    value
                                                                                ) => {
                                                                                    if (
                                                                                        typeof value ===
                                                                                            'object' &&
                                                                                        'id' in
                                                                                            value
                                                                                    ) {
                                                                                        const newCustomFields =
                                                                                            {
                                                                                                ...(field.value ||
                                                                                                    {}),
                                                                                                [customField.id]:
                                                                                                    value.id,
                                                                                            };
                                                                                        field.onChange(
                                                                                            newCustomFields
                                                                                        );
                                                                                    }
                                                                                }}
                                                                                placeholder={`Select ${customField.name}`}
                                                                                required={
                                                                                    customField.required
                                                                                }
                                                                                disable={false}
                                                                            />
                                                                        </div>
                                                                    </FormControl>
                                                                </FormItem>
                                                            );
                                                        }}
                                                    />
                                                );
                                            }

                                            // Text/Number custom fields
                                            return (
                                                <FormField
                                                    key={customField.id}
                                                    control={form.control}
                                                    name="custom_fields"
                                                    render={({ field }) => (
                                                        <FormItem className="w-full">
                                                            <FormControl>
                                                                <MyInput
                                                                    inputType={
                                                                        customField.type ===
                                                                        'number'
                                                                            ? 'number'
                                                                            : 'text'
                                                                    }
                                                                    label={customField.name}
                                                                    inputPlaceholder={`Enter ${customField.name}`}
                                                                    input={
                                                                        field.value?.[
                                                                            customField.id
                                                                        ] || ''
                                                                    }
                                                                    onChangeFunction={(e) => {
                                                                        const newCustomFields = {
                                                                            ...(field.value || {}),
                                                                            [customField.id]:
                                                                                e.target.value,
                                                                        };
                                                                        field.onChange(
                                                                            newCustomFields
                                                                        );
                                                                    }}
                                                                    required={customField.required}
                                                                    size="large"
                                                                    className="w-full"
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* Individual Custom Fields */}
                            {customFieldsData.individualFields.length > 0 && (
                                <div className="flex w-full flex-col gap-4">
                                    {customFieldsData.individualFields.map(
                                        (customField: CustomField) => {
                                            if (customField.type === 'dropdown') {
                                                const dropdownOptions =
                                                    customField.options?.map((option) => ({
                                                        id: option,
                                                        name: option,
                                                    })) || [];

                                                return (
                                                    <FormField
                                                        key={customField.id}
                                                        control={form.control}
                                                        name="custom_fields"
                                                        render={({ field }) => {
                                                            const currentValue =
                                                                field.value?.[customField.id];
                                                            const selectedOption = currentValue
                                                                ? {
                                                                      id: currentValue,
                                                                      name: currentValue,
                                                                  }
                                                                : undefined;

                                                            return (
                                                                <FormItem className="w-full">
                                                                    <FormControl>
                                                                        <div className="flex flex-col gap-1">
                                                                            <label className="text-sm font-medium">
                                                                                {customField.name}
                                                                                {customField.required && (
                                                                                    <span className="ml-1 text-danger-600">
                                                                                        *
                                                                                    </span>
                                                                                )}
                                                                            </label>
                                                                            <MyDropdown
                                                                                currentValue={
                                                                                    selectedOption
                                                                                }
                                                                                dropdownList={
                                                                                    dropdownOptions
                                                                                }
                                                                                handleChange={(
                                                                                    value
                                                                                ) => {
                                                                                    if (
                                                                                        typeof value ===
                                                                                            'object' &&
                                                                                        'id' in
                                                                                            value
                                                                                    ) {
                                                                                        const newCustomFields =
                                                                                            {
                                                                                                ...(field.value ||
                                                                                                    {}),
                                                                                                [customField.id]:
                                                                                                    value.id,
                                                                                            };
                                                                                        field.onChange(
                                                                                            newCustomFields
                                                                                        );
                                                                                    }
                                                                                }}
                                                                                placeholder={`Select ${customField.name}`}
                                                                                required={
                                                                                    customField.required
                                                                                }
                                                                                disable={false}
                                                                            />
                                                                        </div>
                                                                    </FormControl>
                                                                </FormItem>
                                                            );
                                                        }}
                                                    />
                                                );
                                            }

                                            // Text/Number custom fields
                                            return (
                                                <FormField
                                                    key={customField.id}
                                                    control={form.control}
                                                    name="custom_fields"
                                                    render={({ field }) => (
                                                        <FormItem className="w-full">
                                                            <FormControl>
                                                                <MyInput
                                                                    inputType={
                                                                        customField.type ===
                                                                        'number'
                                                                            ? 'number'
                                                                            : 'text'
                                                                    }
                                                                    label={customField.name}
                                                                    inputPlaceholder={`Enter ${customField.name}`}
                                                                    input={
                                                                        field.value?.[
                                                                            customField.id
                                                                        ] || ''
                                                                    }
                                                                    onChangeFunction={(e) => {
                                                                        const newCustomFields = {
                                                                            ...(field.value || {}),
                                                                            [customField.id]:
                                                                                e.target.value,
                                                                        };
                                                                        field.onChange(
                                                                            newCustomFields
                                                                        );
                                                                    }}
                                                                    required={customField.required}
                                                                    size="large"
                                                                    className="w-full"
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            );
                                        }
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </form>
            </FormProvider>
        </MyDialog>
    ) : (
        <p>No Student Found</p>
    );
};
