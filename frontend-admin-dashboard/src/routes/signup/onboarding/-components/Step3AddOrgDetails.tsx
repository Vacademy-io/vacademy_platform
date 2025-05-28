import React from 'react';
import { OrganizationOnboardingProps, Route } from '..';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { MyInput } from '@/components/design-system/input';
import { MyButton } from '@/components/design-system/button';
import { useNavigate } from '@tanstack/react-router';
import { useAddOrgStore } from '../-zustand-store/step2AddOrgZustand';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { handleSignupInstitute } from '../../-services/signup-services';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import useOrganizationStore from '../-zustand-store/step1OrganizationZustand';
import { setAuthorizationCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export interface FormValuesStep1Signup {
    profilePictureUrl: string;
    instituteProfilePic?: string;
    instituteName: string;
    instituteType: string;
    instituteThemeCode?: string;
}

export const organizationDetailsSignupStep1 = z
    .object({
        name: z.string().min(1, 'Name is required'),
        username: z
            .string()
            .min(1, 'Username is required')
            .refine((value) => value === value.toLowerCase(), {
                message: 'Username should not contain uppercase letters',
            }),
        email: z.string().min(1, 'Email is required').email('Invalid email format'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        confirmPassword: z.string().min(1, 'Confirm password is required'),
        roleType: z.array(z.string()).min(1, 'At least one role type is required'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });
type FormValues = z.infer<typeof organizationDetailsSignupStep1>;

const Step3AddOrgDetails: React.FC<OrganizationOnboardingProps> = ({
    currentStep,
    handleCompleteCurrentStep,
    completedSteps,
}) => {
    const queryClient = useQueryClient();
    const searchParams = Route.useSearch();
    const { formDataAddOrg, setFormDataAddOrg, resetAddOrgForm } = useAddOrgStore();
    const { formData, resetForm } = useOrganizationStore();
    console.log(currentStep, completedSteps);
    const navigate = useNavigate();
    const form = useForm<FormValues>({
        resolver: zodResolver(organizationDetailsSignupStep1),
        defaultValues: {
            name: formDataAddOrg.name || '',
            username: formDataAddOrg.username || '',
            email: formDataAddOrg.email || '',
            password: formDataAddOrg.password || '',
            confirmPassword: formDataAddOrg.confirmPassword || '',
            roleType: ['ADMIN'],
        },
        mode: 'onChange',
    });
    const { getValues } = form;
    const isValid =
        !!getValues('name') &&
        !!getValues('username') &&
        !!getValues('email') &&
        !!getValues('password') &&
        !!getValues('confirmPassword');

    const handleSignupInstituteMutation = useMutation({
        mutationFn: async ({
            searchParams,
            formData,
            formDataOrg,
        }: {
            searchParams: Record<string, boolean>;
            formData: FormValuesStep1Signup;
            formDataOrg: z.infer<typeof organizationDetailsSignupStep1>;
        }) => {
            return handleSignupInstitute({ searchParams, formData, formDataOrg });
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_INSTITUTE'] });
            handleCompleteCurrentStep();
            setAuthorizationCookie(TokenKey.accessToken, data.accessToken);
            setAuthorizationCookie(TokenKey.refreshToken, data.refreshToken);
            resetForm();
            resetAddOrgForm();
            navigate({
                to: '/dashboard',
            });
        },
        onError: (error: unknown) => {
            if (error instanceof AxiosError) {
                toast.error(error?.response?.data?.ex, {
                    className: 'error-toast',
                    duration: 2000,
                });
            } else {
                console.error('Unexpected error:', error);
            }
        },
    });

    function onSubmit(values: FormValues) {
        setFormDataAddOrg({ ...values });
        handleSignupInstituteMutation.mutate({
            searchParams,
            formData,
            formDataOrg: values,
        });
    }

    return (
        <FormProvider {...form}>
            <form>
                <div className="my-6 flex flex-col items-center justify-center gap-8">
                    <h1 className="text-[1.6rem]">Create your profile in the organization</h1>
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field: { onChange, value, ...field } }) => (
                            <FormItem>
                                <FormControl>
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder="Full name (First and Last)"
                                        input={value}
                                        onChangeFunction={onChange}
                                        required={true}
                                        error={form.formState.errors.name?.message}
                                        size="large"
                                        label="Full Name"
                                        {...field}
                                        className="w-96"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field: { onChange, value, ...field } }) => (
                            <FormItem>
                                <FormControl>
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder="Enter Username"
                                        input={value}
                                        onChangeFunction={onChange}
                                        required={true}
                                        error={form.formState.errors.username?.message}
                                        size="large"
                                        label="Username"
                                        {...field}
                                        className="w-96"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field: { onChange, value, ...field } }) => (
                            <FormItem>
                                <FormControl>
                                    <MyInput
                                        inputType="email"
                                        inputPlaceholder="Enter Email"
                                        input={value}
                                        onChangeFunction={onChange}
                                        required={true}
                                        error={form.formState.errors.email?.message}
                                        size="large"
                                        label="Email"
                                        {...field}
                                        className="w-96"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field: { onChange, value, ...field } }) => (
                            <FormItem>
                                <FormControl>
                                    <MyInput
                                        inputType="password"
                                        inputPlaceholder="******"
                                        input={value}
                                        onChangeFunction={onChange}
                                        required={true}
                                        error={form.formState.errors.password?.message}
                                        size="large"
                                        label="Password"
                                        {...field}
                                        className="w-96"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field: { onChange, value, ...field } }) => (
                            <FormItem>
                                <FormControl>
                                    <MyInput
                                        inputType="password"
                                        inputPlaceholder="******"
                                        input={value}
                                        onChangeFunction={onChange}
                                        required={true}
                                        error={form.formState.errors.confirmPassword?.message}
                                        size="large"
                                        label="Confirm Password"
                                        {...field}
                                        className="w-96"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        layoutVariant="default"
                        onClick={form.handleSubmit(onSubmit)}
                        className="mt-4"
                        disable={!isValid}
                    >
                        Finish
                    </MyButton>
                </div>
            </form>
        </FormProvider>
    );
};

export default Step3AddOrgDetails;
