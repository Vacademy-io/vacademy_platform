import { MyButton } from '@/components/design-system/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { PencilSimpleLine, Plus } from '@phosphor-icons/react';
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
import convert from 'color-convert';
import { navPresets } from '@/constants/themes/nav-presets';
import { getThemeRoleSettings, saveThemeRoleSettings } from '@/services/theme-role-settings';
import type { NavRoleColors } from '@/types/theme-role-settings';

/** Mirrors the light legacy default in theme-provider.tsx's applyNavRoles. */
const buildLightNavPreview = (brandHex: string): NavRoleColors => {
    const [h, s, l] = convert.hex.hsl(brandHex.replace('#', ''));
    const toHex = (hh: number, ss: number, ll: number) => `#${convert.hsl.hex([hh, ss, ll])}`;
    return {
        surface: toHex(0, 0, 100),
        surfaceHover: toHex(210, 40, 96),
        active: toHex(h, Math.min(s + 40, 100), Math.min(l + 45, 96)),
        activeText: brandHex,
        text: toHex(222.2, 20, 20),
    };
};

const CUSTOM_NAV_ID = 'custom';
// Seeds the 5 pickers with a Charcoal-Rail-like starting point (active item
// uses the institute's real brand color) when a user first switches to
// Custom, so they're editing something real, not black-on-black.
const buildDefaultCustomNav = (brandHex: string): NavRoleColors => {
    const toHex = (hh: number, ss: number, ll: number) => `#${convert.hsl.hex([hh, ss, ll])}`;
    return {
        surface: toHex(220, 10, 13),
        surfaceHover: toHex(220, 10, 18),
        active: brandHex,
        activeText: toHex(0, 0, 100),
        text: toHex(220, 8, 65),
    };
};

const NAV_COLOR_FIELDS: Array<{ key: keyof NavRoleColors; label: string }> = [
    { key: 'surface', label: 'Surface' },
    { key: 'surfaceHover', label: 'Surface hover' },
    { key: 'active', label: 'Active item' },
    { key: 'activeText', label: 'Active text' },
    { key: 'text', label: 'Text' },
];

/**
 * Secondary/tertiary aren't 5 distinct roles like nav — they're a single
 * base color that the learner app ramps into 6 shades (see setShadeRamp in
 * that app's theme-provider.tsx). This mirrors that exact clamp curve so the
 * preview strip matches what will actually render.
 */
const buildShadeRampPreview = (hex: string): string[] => {
    try {
        const [h, s, l] = convert.hex.hsl(hex.replace('#', ''));
        const toHex = (hh: number, ss: number, ll: number) => `#${convert.hsl.hex([hh, ss, ll])}`;
        return [
            toHex(h, Math.min(s + 40, 100), Math.min(l + 45, 96)),
            toHex(h, Math.min(s + 30, 90), Math.min(l + 38, 92)),
            toHex(h, Math.min(s + 20, 88), Math.min(l + 29, 83)),
            toHex(h, Math.min(s + 10, 87), Math.min(l + 18, 72)),
            toHex(h, Math.min(s + 5, 86), Math.min(l + 7, 61)),
            hex,
        ];
    } catch {
        return [];
    }
};

// Seeds a secondary/tertiary override with the same hue-shift heuristic the
// learner app uses for a custom brand hex, so switching the toggle on starts
// from something on-brand rather than an arbitrary color.
const buildDefaultSecondaryHex = (brandHex: string): string => {
    const [h, s, l] = convert.hex.hsl(brandHex.replace('#', ''));
    return `#${convert.hsl.hex([((h - 24) % 360 + 360) % 360, Math.max(s - 25, 20), Math.min(l + 15, 80)])}`;
};
const buildDefaultTertiaryHex = (brandHex: string): string => {
    const [h, s, l] = convert.hex.hsl(brandHex.replace('#', ''));
    return `#${convert.hsl.hex([((h + 48) % 360 + 360) % 360, Math.max(s - 35, 15), Math.min(l + 25, 88)])}`;
};

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
    const [selectedNavPresetId, setSelectedNavPresetId] = useState(navPresets[0]!.id);
    const [customNav, setCustomNav] = useState<NavRoleColors | null>(null);
    const [secondaryOverride, setSecondaryOverride] = useState<string | null>(null);
    const [tertiaryOverride, setTertiaryOverride] = useState<string | null>(null);
    const [isSavingNav, setIsSavingNav] = useState(false);
    const { setPrimaryColor, getPrimaryColorCode } = useTheme();

    // Load whatever nav role is already saved for this institute whenever the
    // theme dialog opens, so re-opening it doesn't silently reset the choice.
    useEffect(() => {
        if (!openThemeDialog) return;
        let cancelled = false;
        getThemeRoleSettings().then((saved) => {
            if (cancelled) return;
            setSecondaryOverride(saved?.roles?.secondary ?? null);
            setTertiaryOverride(saved?.roles?.tertiary ?? null);
            if (!saved?.roles?.nav) {
                setSelectedNavPresetId('match-brand');
                return;
            }
            const brandHex = getPrimaryColorCode();
            const matched = navPresets.find((preset) => {
                const built = preset.build(brandHex);
                return built && built.surface.toLowerCase() === saved.roles!.nav!.surface.toLowerCase();
            });
            if (matched) {
                setSelectedNavPresetId(matched.id);
            } else {
                // Saved colors don't match any curated preset exactly — this
                // is a previously-saved custom nav. Load it into the editor
                // rather than silently falling back to a preset.
                setSelectedNavPresetId(CUSTOM_NAV_ID);
                setCustomNav(saved.roles!.nav!);
            }
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openThemeDialog]);

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
            queryClient.invalidateQueries({ queryKey: ['GET_BOTH_INSTITUTE_APIS'] });
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

    const handleSaveThemeDialog = async () => {
        setIsSavingNav(true);
        try {
            const brandHex = getPrimaryColorCode();
            const nav =
                selectedNavPresetId === CUSTOM_NAV_ID
                    ? (customNav ?? buildDefaultCustomNav(brandHex))
                    : (navPresets.find((p) => p.id === selectedNavPresetId) ?? navPresets[0]!).build(
                          brandHex
                      );
            await saveThemeRoleSettings({
                version: 2,
                mode: selectedNavPresetId === CUSTOM_NAV_ID ? 'custom' : nav ? 'preset' : 'legacy',
                roles: {
                    ...(nav ? { nav } : {}),
                    ...(secondaryOverride ? { secondary: secondaryOverride } : {}),
                    ...(tertiaryOverride ? { tertiary: tertiaryOverride } : {}),
                },
            });
        } catch (error) {
            console.error('Failed to save nav theme', error);
            toast.error('Could not save sidebar color — brand color was still updated.', {
                className: 'error-toast',
                duration: 2500,
            });
        } finally {
            setIsSavingNav(false);
            setThemeDialog(false);
        }
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
                <DialogContent className="flex h-4/5 max-h-[85vh] w-[calc(100vw-2rem)] flex-col p-0 [&>button>svg]:size-5 [&>button>svg]:text-neutral-600 sm:w-1/3">{/* design-lint-ignore: viewport-relative dialog sizing for mobile */}
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
                                                    className="size-52 object-contain"
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
                                                labelStyle="text-base font-normal"
                                                control={form.control}
                                                className="w-full text-base"
                                                required
                                            />

                                            <Separator />
                                            <h1 className="text-lg font-semibold">
                                                Contact Information
                                            </h1>

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
                                                                labelStyle="text-base font-normal"
                                                                required={false}
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
                                            <h1 className="text-lg font-semibold">
                                                Location Details
                                            </h1>

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
                                            <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
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
                                                                    className="w-full sm:w-auto"
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
                                                                    className="w-full sm:w-auto"
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
                                            <h1 className="text-lg font-semibold">
                                                Institute Theme
                                            </h1>
                                            <div className="flex w-full flex-col gap-2">
                                                <h1 className="whitespace-nowrap">Current</h1>
                                                <div className="flex items-center gap-4">
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
                                                                        {shades.map(
                                                                            (shade, index) => (
                                                                                <div
                                                                                    key={index}
                                                                                    className="h-5"
                                                                                    style={{
                                                                                        backgroundColor:
                                                                                            shade,
                                                                                    }}
                                                                                />
                                                                            )
                                                                        )}
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
                                                        className="text-sm sm:w-1/3"
                                                        onClick={() => setThemeDialog(true)}
                                                    >
                                                        Change Theme
                                                    </MyButton>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Fixed Save Changes button */}
                                <div className="flex justify-center bg-white p-4 pb-0">
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
                <DialogContent className="flex h-4/5 max-h-[85vh] w-[calc(100vw-2rem)] flex-col p-0 [&>button>svg]:size-5 [&>button>svg]:text-neutral-600 sm:w-1/3">{/* design-lint-ignore: viewport-relative dialog sizing for mobile */}
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

                            <Separator className="my-4" />
                            <h1 className="mb-1 text-lg">Secondary &amp; tertiary colors</h1>
                            <p className="mb-4 text-sm text-neutral-500">
                                Supporting accent colors used across the learner app (badges,
                                secondary highlights). Auto-generated from your brand color above
                                unless you set one here — this only affects the learner app; the
                                admin dashboard doesn&apos;t use these colors.
                            </p>
                            <div className="mb-4 flex flex-col gap-4">
                                {(
                                    [
                                        {
                                            key: 'secondary' as const,
                                            label: 'Secondary color',
                                            value: secondaryOverride,
                                            setValue: setSecondaryOverride,
                                            buildDefault: buildDefaultSecondaryHex,
                                        },
                                        {
                                            key: 'tertiary' as const,
                                            label: 'Tertiary color',
                                            value: tertiaryOverride,
                                            setValue: setTertiaryOverride,
                                            buildDefault: buildDefaultTertiaryHex,
                                        },
                                    ]
                                ).map(({ key, label, value, setValue, buildDefault }) => {
                                    const brandHex = getPrimaryColorCode();
                                    const isOverridden = value != null;
                                    const currentHex = value ?? buildDefault(brandHex);
                                    const ramp = buildShadeRampPreview(currentHex);
                                    return (
                                        <div key={key} className="rounded-lg border border-gray-200 p-3">
                                            <div className="mb-2 flex items-center justify-between">
                                                <span className="text-sm font-medium">{label}</span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setValue(isOverridden ? null : buildDefault(brandHex))
                                                    }
                                                    className="text-xs font-medium text-primary-500 hover:underline"
                                                >
                                                    {isOverridden ? 'Reset to auto' : 'Customize'}
                                                </button>
                                            </div>
                                            {isOverridden && (
                                                <div className="mb-2 flex items-center gap-2">
                                                    {/* design-lint-ignore: native color input — the value is
                                                        user-chosen per-institute data, not a static token. */}
                                                    <input
                                                        type="color"
                                                        value={currentHex}
                                                        onChange={(e) => setValue(e.target.value)}
                                                        className="h-8 w-8 cursor-pointer rounded border border-gray-200 p-0"
                                                        aria-label={`${label} color`}
                                                    />
                                                    <MyInput
                                                        inputType="text"
                                                        input={currentHex}
                                                        onChangeFunction={(e) => setValue(e.target.value)}
                                                        size="small"
                                                        className="w-24 font-mono text-xs"
                                                        inputPlaceholder="Hex color"
                                                    />
                                                </div>
                                            )}
                                            {/* design-lint-ignore: computed per-institute ramp preview,
                                                not static — can't be a Tailwind token. */}
                                            <div className="flex overflow-hidden rounded-md">
                                                {ramp.map((swatch, i) => (
                                                    <div
                                                        key={i}
                                                        className="h-5 flex-1"
                                                        style={{ backgroundColor: swatch }}
                                                    />
                                                ))}
                                            </div>
                                            {!isOverridden && (
                                                <p className="mt-1 text-xs text-neutral-400">
                                                    Auto — preview only, exact shade depends on your
                                                    selected brand theme.
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <Separator className="my-4" />
                            <h1 className="mb-1 text-lg">Sidebar color</h1>
                            <p className="mb-4 text-sm text-neutral-500">
                                Give your sidebar its own look, independent of the brand color
                                above — like Slack&apos;s sidebar themes.
                            </p>
                            <div className="mb-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
                                {navPresets.map((preset) => (
                                    <div
                                        key={preset.id}
                                        role="button"
                                        onClick={() => setSelectedNavPresetId(preset.id)}
                                        className={cn(
                                            'flex flex-col gap-2 rounded-lg p-3 text-left shadow-sm transition-shadow hover:shadow-md',
                                            selectedNavPresetId === preset.id
                                                ? 'ring-2 ring-primary-500 ring-offset-2'
                                                : 'ring-1 ring-gray-200'
                                        )}
                                        aria-label={`Select ${preset.label} sidebar`}
                                    >
                                        <span className="text-sm font-medium">{preset.label}</span>
                                        <span className="text-xs text-neutral-500">
                                            {preset.description}
                                        </span>
                                    </div>
                                ))}
                                <div
                                    role="button"
                                    onClick={() => {
                                        setSelectedNavPresetId(CUSTOM_NAV_ID);
                                        setCustomNav(
                                            (prev) => prev ?? buildDefaultCustomNav(getPrimaryColorCode())
                                        );
                                    }}
                                    className={cn(
                                        'flex flex-col gap-2 rounded-lg p-3 text-left shadow-sm transition-shadow hover:shadow-md',
                                        selectedNavPresetId === CUSTOM_NAV_ID
                                            ? 'ring-2 ring-primary-500 ring-offset-2'
                                            : 'ring-1 ring-gray-200'
                                    )}
                                    aria-label="Select Custom sidebar"
                                >
                                    <span className="text-sm font-medium">Custom</span>
                                    <span className="text-xs text-neutral-500">
                                        Pick every color yourself.
                                    </span>
                                </div>
                            </div>

                            {selectedNavPresetId === CUSTOM_NAV_ID && (
                                <div className="mb-4 flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
                                    {NAV_COLOR_FIELDS.map(({ key, label }) => {
                                        const current =
                                            customNav ?? buildDefaultCustomNav(getPrimaryColorCode());
                                        return (
                                            <div key={key} className="flex items-center justify-between gap-3">
                                                <span className="text-sm text-neutral-700">{label}</span>
                                                <div className="flex items-center gap-2">
                                                    {/* design-lint-ignore: native color input — the value is
                                                        user-chosen per-institute data, not a static token. */}
                                                    <input
                                                        type="color"
                                                        value={current[key]}
                                                        onChange={(e) =>
                                                            setCustomNav({ ...current, [key]: e.target.value })
                                                        }
                                                        className="h-8 w-8 cursor-pointer rounded border border-gray-200 p-0"
                                                        aria-label={`${label} color`}
                                                    />
                                                    <MyInput
                                                        inputType="text"
                                                        input={current[key]}
                                                        onChangeFunction={(e) =>
                                                            setCustomNav({
                                                                ...current,
                                                                [key]: e.target.value,
                                                            })
                                                        }
                                                        size="small"
                                                        className="w-24 font-mono text-xs"
                                                        inputPlaceholder="Hex color"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Live preview — a self-contained mockup, not the real sidebar,
                                so previewing a choice can never affect the live app. */}
                            {(() => {
                                const brandHex = getPrimaryColorCode();
                                const nav =
                                    selectedNavPresetId === CUSTOM_NAV_ID
                                        ? (customNav ?? buildDefaultCustomNav(brandHex))
                                        : ((
                                              navPresets.find((p) => p.id === selectedNavPresetId) ??
                                              navPresets[0]!
                                          ).build(brandHex) ?? buildLightNavPreview(brandHex));
                                return (
                                    // design-lint-ignore: computed per-institute nav colors (brand hex
                                    // + selected preset), not static — can't be a Tailwind token.
                                    <div
                                        className="w-48 rounded-lg p-2 shadow-sm"
                                        style={{ backgroundColor: nav.surface }}
                                    >
                                        {['Dashboard', 'Courses', 'Learners'].map((label, i) => (
                                            <div
                                                key={label}
                                                className="mb-1 rounded-md px-2 py-1.5 text-xs font-medium"
                                                style={
                                                    i === 0
                                                        ? {
                                                              backgroundColor: nav.active,
                                                              color: nav.activeText,
                                                          }
                                                        : { color: nav.text }
                                                }
                                            >
                                                {label}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Fixed Save Changes button */}
                        <div className="flex justify-center bg-white p-4 pb-0">
                            <MyButton
                                type="submit"
                                scale="large"
                                buttonType="secondary"
                                layoutVariant="default"
                                onClick={handleSaveThemeDialog}
                                disable={
                                    isSavingNav ||
                                    Object.keys(form.formState.errors).length > 0
                                }
                            >
                                {isSavingNav ? 'Saving…' : 'Save'}
                            </MyButton>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default EditDashboardProfileComponent;
