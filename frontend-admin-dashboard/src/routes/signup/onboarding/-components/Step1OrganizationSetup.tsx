import React, { useRef, useState } from 'react';
import { OrganizationOnboardingProps } from '..';
import { OnboardingFrame } from '@/svgs';
import { z } from 'zod';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { MyInput } from '@/components/design-system/input';
import SelectField from '@/components/design-system/select-field';
import { InstituteType } from '@/constants/dummy-data';
import { MyButton } from '@/components/design-system/button';
import { PencilSimpleLine } from '@phosphor-icons/react';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { UploadFileInS3Public } from '../../-services/signup-services';
import useOrganizationStore from '../-zustand-store/step1OrganizationZustand';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

const organizationSetupSchema = z.object({
    profilePictureUrl: z.string(),
    instituteProfilePic: z.union([z.string(), z.undefined()]),
    instituteName: z.string().min(1, 'Institute Name is required'),
    instituteType: z.string().min(1, 'Select institute type'),
    instituteThemeCode: z.union([z.string(), z.undefined()]),
});

type FormValues = z.infer<typeof organizationSetupSchema>;

const Step1OrganizationSetup: React.FC<OrganizationOnboardingProps> = ({
    currentStep,
    handleCompleteCurrentStep,
    completedSteps,
}) => {
    const INSTITUTE_ID = getCurrentInstituteId();
    console.log(currentStep, completedSteps);
    const { formData, setFormData } = useOrganizationStore();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const form = useForm<FormValues>({
        resolver: zodResolver(organizationSetupSchema),
        defaultValues: {
            profilePictureUrl: formData.profilePictureUrl || '',
            instituteProfilePic: formData.instituteProfilePic || undefined,
            instituteName: formData.instituteName || '',
            instituteType: formData.instituteType || '',
            instituteThemeCode: formData.instituteThemeCode ?? '',
        },
        mode: 'onChange',
    });
    const isValid = !!form.getValues('instituteName') && !!form.getValues('instituteType');
    form.watch();
    function onSubmit(values: FormValues) {
        handleCompleteCurrentStep();
        setFormData(values);
    }

    const handleFileSubmit = async (file: File) => {
        try {
            setIsUploading(true);
            // need to change soruce and soruceid and userId
            const fileId = await UploadFileInS3Public(
                file,
                setIsUploading,
                INSTITUTE_ID,
                'STUDENTS'
            );
            const imageUrl = URL.createObjectURL(file);
            form.setValue('profilePictureUrl', imageUrl);
            form.setValue('instituteProfilePic', fileId);
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <FormProvider {...form}>
            <form>
                <div className="flex flex-col items-center justify-center gap-4 lg:gap-8">
                    <h1 className="text-xl lg:text-[1.6rem]">Share your organization details</h1>
                    <div className="relative">
                        {form.getValues('profilePictureUrl') ? (
                            <img
                                src={form.getValues('profilePictureUrl')}
                                alt="logo"
                                className="size-32 rounded-full lg:size-52"
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
                            name="instituteProfilePic"
                            acceptedFileTypes="image/*" // Optional - remove this line to accept all files
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
                    <FormField
                        control={form.control}
                        name="instituteName"
                        render={({ field: { onChange, value, ...field } }) => (
                            <FormItem className="w-full max-w-sm">
                                <FormControl>
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder="Institute Name"
                                        input={value}
                                        onChangeFunction={onChange}
                                        required={true}
                                        error={form.formState.errors.instituteName?.message}
                                        size="large"
                                        label="Institute Name"
                                        {...field}
                                        className="w-full"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <div className="w-full max-w-sm">
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
                    </div>
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        layoutVariant="default"
                        onClick={form.handleSubmit(onSubmit)}
                        className="mt-4"
                        disable={!isValid}
                    >
                        Continue
                    </MyButton>
                </div>
            </form>
        </FormProvider>
    );
};

export default Step1OrganizationSetup;
