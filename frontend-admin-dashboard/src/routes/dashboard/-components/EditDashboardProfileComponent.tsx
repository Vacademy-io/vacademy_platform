import { MyButton } from '@/components/design-system/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { PencilSimpleLine, Plus } from 'phosphor-react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { editDashboardProfileSchema } from '../-utils/edit-dashboard-profile-schema';
import { OnboardingFrame } from '@/svgs';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { UploadFileInS3Public } from '@/routes/signup/-services/signup-services';
import { useEffect, useRef, useState } from 'react';
import { getInstituteId } from '@/constants/helper';
import { MyInput } from '@/components/design-system/input';
import SelectField from '@/components/design-system/select-field';
import { InstituteType } from '@/constants/dummy-data';
import { Separator } from '@/components/ui/separator';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { getPublicUrl } from '@/services/upload_file';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { handleUpdateInstituteDashboard } from '../-services/dashboard-services';
import PhoneInputField from '@/components/design-system/phone-input-field';
import themeData from '@/constants/themes/theme.json';
import { useTheme } from '@/providers/theme/theme-provider';
import { cn } from '@/lib/utils';

// Predefined themes with their base colors
const presetThemes = [
    { name: 'Orange', code: 'primary' },
    { name: 'Blue', code: 'blue' },
    { name: 'Green', code: 'green' },
    { name: 'Purple', code: 'purple' },
    { name: 'Red', code: 'red' },
    { name: 'Pink', code: 'pink' },
    { name: 'Indigo', code: 'indigo' },
    { name: 'Yellow', code: 'amber' },
    { name: 'Cyan', code: 'cyan' },
];

type FormValues = z.infer<typeof editDashboardProfileSchema>;

const EditDashboardProfileComponent = ({ isEdit }: { isEdit: boolean }) => {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [openThemeDialog, setThemeDialog] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState(presetThemes[0]?.code || 'primary');
    const { setPrimaryColor } = useTheme();

    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const instituteId = getInstituteId();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const form = useForm<FormValues>({
        resolver: zodResolver(editDashboardProfileSchema),
        defaultValues: {
            instituteProfilePictureUrl: '',
            instituteProfilePictureId: undefined,
            instituteThemeCode: instituteDetails?.institute_theme_code ?? '',
            instituteName: '',
            instituteType: '',
            instituteEmail: '',
            institutePhoneNumber: '',
            instituteWebsite: '',
            instituteAddress: '',
            instituteCountry: '',
            instituteState: '',
            instituteCity: '',
            institutePinCode: '',
        },
        mode: 'onChange',
    });

    const { handleSubmit } = form;
    const handleFileSubmit = async (file: File) => {
        try {
            setIsUploading(true);
            // need to change soruce and soruceid and userId
            const fileId = await UploadFileInS3Public(
                file,
                setIsUploading,
                instituteId,
                'STUDENTS'
            );
            const imageUrl = URL.createObjectURL(file);
            form.setValue('instituteProfilePictureUrl', imageUrl);
            form.setValue('instituteProfilePictureId', fileId);
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmitEditDataMutation = useMutation({
        mutationFn: ({
            data,
            instituteId,
        }: {
            data: z.infer<typeof editDashboardProfileSchema>;
            instituteId: string | undefined;
        }) => handleUpdateInstituteDashboard(data, instituteId),
        onSuccess: () => {
            toast.success('Your details has been updated successfully!', {
                className: 'success-toast',
                duration: 2000,
            });
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_INSTITUTE'] });
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

    function onSubmit(values: FormValues) {
        handleSubmitEditDataMutation.mutate({
            data: values,
            instituteId: instituteDetails?.id,
        });
    }

    const onInvalid = (err: unknown) => {
        console.log(err);
    };

    useEffect(() => {
        const resetFormWithUrl = async () => {
            const publicUrl = await getPublicUrl(instituteDetails?.institute_logo_file_id);
            form.reset({
                instituteProfilePictureUrl: publicUrl,
                instituteProfilePictureId: instituteDetails?.institute_logo_file_id ?? undefined,
                instituteName: instituteDetails?.institute_name,
                instituteType: instituteDetails?.type,
                instituteEmail: instituteDetails?.email,
                institutePhoneNumber: instituteDetails?.phone,
                instituteWebsite: instituteDetails?.website_url,
                instituteAddress: instituteDetails?.address,
                instituteCountry: instituteDetails?.country,
                instituteState: instituteDetails?.state,
                instituteCity: instituteDetails?.city,
                institutePinCode: instituteDetails?.pin_code,
                instituteThemeCode: instituteDetails?.institute_theme_code ?? 'primary',
            });
        };
        resetFormWithUrl();
    }, [instituteDetails]);

    const getThemeShades = (code: string) => {
        console.log('code', code);
        const theme = themeData.themes.find((theme) => theme.code === code);
        if (theme && theme.colors) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            return Object.entries(theme.colors).map(([key, color]) => color);
        }
        return [];
    };

    const handleThemeSelect = (code: string) => {
        setSelectedTheme(code);
        setPrimaryColor(code);
        form.setValue('instituteThemeCode', code);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger>
                    {isEdit ? (
                        <>
                            <MyButton
                                type="submit"
                                scale="large"
                                buttonType="secondary"
                                layoutVariant="default"
                                className="text-sm"
                            >
                                Edit Institute
                            </MyButton>
                        </>
                    ) : (
                        <MyButton
                            type="submit"
                            scale="medium"
                            buttonType="secondary"
                            layoutVariant="default"
                            className="text-sm"
                        >
                            <Plus size={32} />
                            Add Details
                        </MyButton>
                    )}
                </DialogTrigger>
                <DialogContent className="flex h-4/5 w-1/3 flex-col p-0 [&>button>svg]:size-5 [&>button>svg]:text-neutral-600">
                    <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                        Edit Institute
                    </h1>
                    <div className="flex h-full flex-1 flex-col">
                        <FormProvider {...form}>
                            <form
                                className="flex h-[86%] flex-col"
                                onSubmit={handleSubmit(onSubmit, onInvalid)}
                            >
                                {/* Scrollable form content */}
                                <div className="flex-1 overflow-y-auto p-4">
                                    <div className="flex flex-col items-center justify-center gap-8">
                                        {/* Profile Picture Upload */}
                                        <div className="relative">
                                            {form.getValues('instituteProfilePictureUrl') ? (
                                                <img
                                                    src={form.getValues(
                                                        'instituteProfilePictureUrl'
                                                    )}
                                                    alt="logo"
                                                    className="size-52 rounded-full"
                                                />
                                            ) : (
                                                <div className="rounded-full object-cover">
                                                    <OnboardingFrame className="mt-4" />
                                                </div>
                                            )}
                                            <FileUploadComponent
                                                fileInputRef={fileInputRef}
                                                onFileSubmit={handleFileSubmit}
                                                control={form.control}
                                                name="instituteProfilePictureId"
                                                acceptedFileTypes="image/*"
                                            />
                                            <MyButton
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                                buttonType="secondary"
                                                layoutVariant="icon"
                                                scale="small"
                                                className="absolute bottom-0 right-0 bg-white"
                                            >
                                                <PencilSimpleLine />
                                            </MyButton>
                                        </div>

                                        {/* Form Fields */}
                                        <div className="flex w-full flex-col gap-4">
                                            {/* instituteName */}
                                            <FormField
                                                control={form.control}
                                                name="instituteName"
                                                render={({
                                                    field: { onChange, value, ...field },
                                                }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <MyInput
                                                                inputType="text"
                                                                inputPlaceholder="Institute Name"
                                                                input={value}
                                                                onChangeFunction={onChange}
                                                                required={true}
                                                                error={
                                                                    form.formState.errors
                                                                        .instituteName?.message
                                                                }
                                                                size="large"
                                                                label="Institute Name"
                                                                className="w-full"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <SelectField
                                                label="Institute Type"
                                                name="instituteType"
                                                options={InstituteType.map((option, index) => ({
                                                    value: option,
                                                    label: option,
                                                    _id: index,
                                                }))}
                                                control={form.control}
                                                className="w-full"
                                                required
                                            />

                                            <Separator />
                                            <h1>Contact Information</h1>

                                            <FormField
                                                control={form.control}
                                                name="instituteEmail"
                                                render={({
                                                    field: { onChange, value, ...field },
                                                }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <MyInput
                                                                inputType="text"
                                                                inputPlaceholder="Institute Email"
                                                                input={value}
                                                                onChangeFunction={onChange}
                                                                error={
                                                                    form.formState.errors
                                                                        .instituteEmail?.message
                                                                }
                                                                size="large"
                                                                label="Institute Email"
                                                                className="w-full"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="institutePhoneNumber"
                                                render={({ field: { value } }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <PhoneInputField
                                                                label="Institute Phone Number"
                                                                placeholder="123 456 7890"
                                                                name="institutePhoneNumber"
                                                                control={form.control}
                                                                country="in"
                                                                required={false}
                                                                value={value}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="instituteWebsite"
                                                render={({
                                                    field: { onChange, value, ...field },
                                                }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <MyInput
                                                                inputType="text"
                                                                inputPlaceholder="Institute Website"
                                                                input={value}
                                                                onChangeFunction={onChange}
                                                                error={
                                                                    form.formState.errors
                                                                        .instituteWebsite?.message
                                                                }
                                                                size="large"
                                                                label="Institute Website"
                                                                className="w-full"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <Separator />
                                            <h1>Location Details</h1>

                                            <FormField
                                                control={form.control}
                                                name="instituteAddress"
                                                render={({
                                                    field: { onChange, value, ...field },
                                                }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <MyInput
                                                                inputType="text"
                                                                inputPlaceholder="Address line 1"
                                                                input={value}
                                                                onChangeFunction={onChange}
                                                                error={
                                                                    form.formState.errors
                                                                        .instituteAddress?.message
                                                                }
                                                                size="large"
                                                                label="Address"
                                                                className="w-full"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <div className="flex flex-wrap items-start justify-between gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="instituteCity"
                                                    render={({
                                                        field: { onChange, value, ...field },
                                                    }) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <MyInput
                                                                    inputType="text"
                                                                    inputPlaceholder="Select City/Village"
                                                                    input={value}
                                                                    onChangeFunction={onChange}
                                                                    error={
                                                                        form.formState.errors
                                                                            .instituteCity?.message
                                                                    }
                                                                    size="large"
                                                                    className="w-auto"
                                                                    label="City/Village"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="instituteState"
                                                    render={({
                                                        field: { onChange, value, ...field },
                                                    }) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <MyInput
                                                                    inputType="text"
                                                                    inputPlaceholder="Select State"
                                                                    input={value}
                                                                    onChangeFunction={onChange}
                                                                    error={
                                                                        form.formState.errors
                                                                            .instituteState?.message
                                                                    }
                                                                    className="w-auto"
                                                                    size="large"
                                                                    label="State"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="instituteCountry"
                                                render={({
                                                    field: { onChange, value, ...field },
                                                }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <MyInput
                                                                inputType="text"
                                                                inputPlaceholder="Select Country"
                                                                input={value}
                                                                onChangeFunction={onChange}
                                                                error={
                                                                    form.formState.errors
                                                                        .instituteCountry?.message
                                                                }
                                                                size="large"
                                                                label="Country"
                                                                className="w-full"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="institutePinCode"
                                                render={({
                                                    field: { onChange, value, ...field },
                                                }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <MyInput
                                                                inputType="text"
                                                                inputPlaceholder="Enter Pincode"
                                                                input={value}
                                                                onChangeFunction={(
                                                                    e: React.ChangeEvent<HTMLInputElement>
                                                                ) => {
                                                                    const filteredValue =
                                                                        e.target.value
                                                                            .replace(/[^0-9+]/g, '') // allow only + and numbers
                                                                            .slice(0, 11); // limit to 10 characters

                                                                    onChange(filteredValue);
                                                                }}
                                                                error={
                                                                    form.formState.errors
                                                                        .institutePinCode?.message
                                                                }
                                                                size="large"
                                                                label="Pincode"
                                                                className="w-full"
                                                                maxLength={11}
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        {/* Institute Theme */}
                                        <div className="flex w-full flex-col gap-4">
                                            <Separator />
                                            <h1>Institute Theme</h1>
                                            <div className="flex w-full flex-col gap-2">
                                                <h1 className="whitespace-nowrap">Current</h1>
                                                <div className="mb-2 w-36">
                                                    {(() => {
                                                        const currentThemeCode =
                                                            form.watch('instituteThemeCode');
                                                        const theme = themeData.themes.find(
                                                            (t) => t.code === currentThemeCode
                                                        );
                                                        const shades = theme?.colors
                                                            ? Object.entries(theme.colors).map(
                                                                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                                                  ([_, color]) => color
                                                              )
                                                            : [];

                                                        return (
                                                            <div className="overflow-hidden rounded-lg shadow-sm">
                                                                <div className="flex flex-col">
                                                                    {shades.map((shade, index) => (
                                                                        <div
                                                                            key={index}
                                                                            className="h-5"
                                                                            style={{
                                                                                backgroundColor:
                                                                                    shade,
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <MyButton
                                                    type="button"
                                                    scale="medium"
                                                    buttonType="secondary"
                                                    layoutVariant="default"
                                                    className="w-1/3 text-sm"
                                                    onClick={() => setThemeDialog(true)}
                                                >
                                                    Change Theme
                                                </MyButton>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Fixed Save Changes button */}
                                <div className="flex justify-end bg-white p-4 pb-0">
                                    <MyButton
                                        type="submit"
                                        scale="large"
                                        buttonType="secondary"
                                        layoutVariant="default"
                                        disable={Object.keys(form.formState.errors).length > 0}
                                    >
                                        Save Changes
                                    </MyButton>
                                </div>
                            </form>
                        </FormProvider>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={openThemeDialog} onOpenChange={setThemeDialog}>
                <DialogContent className="flex h-4/5 w-1/3 flex-col p-0 [&>button>svg]:size-5 [&>button>svg]:text-neutral-600">
                    <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                        Select Theme
                    </h1>
                    <div className="flex h-[86%] flex-col">
                        {/* Scrollable form content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <h1 className="mb-4 text-lg">Set your organization theme</h1>
                            <div className="mb-2 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                                {presetThemes.map((theme) => {
                                    const shades = getThemeShades(theme.code);
                                    return (
                                        <div
                                            key={theme.name}
                                            role="button"
                                            onClick={() => handleThemeSelect(theme.code)}
                                            className={cn(
                                                'overflow-hidden rounded-lg shadow-sm transition-shadow hover:shadow-md',
                                                selectedTheme === theme.code
                                                    ? 'ring-2 ring-primary-500 ring-offset-2'
                                                    : 'ring-1 ring-gray-200'
                                            )}
                                            aria-label={`Select ${theme.name} theme`}
                                        >
                                            <div className="flex flex-col">
                                                {shades?.map((shade, index) => (
                                                    <div
                                                        key={index}
                                                        className="h-5"
                                                        style={{ backgroundColor: shade }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Fixed Save Changes button */}
                        <div className="flex justify-end bg-white p-4 pb-0">
                            <MyButton
                                type="submit"
                                scale="large"
                                buttonType="secondary"
                                layoutVariant="default"
                                onClick={() => setThemeDialog(false)}
                                disable={Object.keys(form.formState.errors).length > 0}
                            >
                                Save
                            </MyButton>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default EditDashboardProfileComponent;
