import { Checkbox } from '@/components/ui/checkbox';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
} from '@/components/ui/form';
import { OnboardingSignup, VacademyAssessLogo, VacademyLMSLogo } from '@/svgs';
import { MyButton } from '@/components/design-system/button';
import { Plus } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import useOrganizationStore from '../onboarding/-zustand-store/step1OrganizationZustand';
import { useEffect } from 'react';
import { GitHubIcon } from '@/components/icons/GitHubIcon';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { handleOAuthSignUp } from '@/hooks/signup/oauth-signup';
import VacademyVoltLogo from '@/components/core/volt-logo';
import VacademyVSmartLogo from '@/components/core/vsmart-logo';
import useInstituteLogoStore from '@/components/common/layout-container/sidebar/institutelogo-global-zustand';

const items = [
    { id: 'assess', label: 'Assess', description: 'Smart assessment and evaluation platform' },
    { id: 'lms', label: 'LMS', description: 'Complete learning management system' },
    { id: 'volt', label: 'Volt', description: 'Interactive live classroom experience' },
    { id: 'vsmart', label: 'Vsmart', description: 'AI-powered learning assistant' },
] as const;

const FormSchema = z.object({
    items: z
        .record(z.boolean())
        .refine((value) => Object.values(value).some((checked) => checked), {
            message: 'You have to select at least one item.',
        }),
});

export function SignUpComponent() {
    const navigate = useNavigate();
    const { resetForm } = useOrganizationStore();
    const { instituteLogo } = useInstituteLogoStore();

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            items: {
                assess: false,
                lms: false,
                volt: false,
                vsmart: false,
            },
        },
        mode: 'onChange',
    });

    function onSubmit(data: z.infer<typeof FormSchema>) {
        console.log(data);
    }

    useEffect(() => {
        resetForm();
    }, [resetForm]);

    return (
        <div className="flex min-h-screen w-full flex-col lg:flex-row">
            <div className="hidden w-2/5 flex-col items-center justify-center bg-primary-50 lg:flex">
                {instituteLogo ? (
                    <img
                        src={instituteLogo}
                        alt="Institute Logo"
                        className="mb-4 size-16 rounded-full object-cover"
                    />
                ) : null}
                <OnboardingSignup className="w-[500px]" />
            </div>
            <div className="flex w-full items-center justify-center py-10 lg:w-3/5 lg:py-0">
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="flex w-full max-w-[550px] flex-col items-center justify-center space-y-8 px-6"
                    >
                        <div className="flex w-full flex-col items-center justify-center">
                            <div className="mb-10 flex flex-col items-center justify-center">
                                <FormLabel className="text-center text-[1.5rem]">
                                    Evaluate smarter, learn better
                                </FormLabel>
                                <FormDescription className="text-center">
                                    Redefining Education with Insightful Tools for Smarter
                                    Evaluations and Better Learning Outcomes.
                                </FormDescription>
                            </div>

                            <div className="flex w-full flex-col gap-4">
                                <button
                                    type="button"
                                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() =>
                                        handleOAuthSignUp('google', {
                                            isSignup: true,
                                            assess: form.getValues('items.assess'),
                                            lms: form.getValues('items.lms'),
                                        })
                                    }
                                    disabled={
                                        !form.getValues('items.assess') &&
                                        !form.getValues('items.lms') &&
                                        !form.getValues('items.volt') &&
                                        !form.getValues('items.vsmart')
                                    }
                                >
                                    <GoogleIcon size={20} />
                                    Continue with Google
                                </button>

                                <button
                                    type="button"
                                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() =>
                                        handleOAuthSignUp('github', {
                                            isSignup: true,
                                            assess: form.getValues('items.assess'),
                                            lms: form.getValues('items.lms'),
                                            volt: form.getValues('items.volt'),
                                            vsmart: form.getValues('items.vsmart'),
                                        })
                                    }
                                    disabled={
                                        !form.getValues('items.assess') &&
                                        !form.getValues('items.lms') &&
                                        !form.getValues('items.volt') &&
                                        !form.getValues('items.vsmart')
                                    }
                                >
                                    <GitHubIcon className="size-5" />
                                    Continue with GitHub
                                </button>

                                <div className="relative flex items-center justify-center">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative bg-white px-4 text-sm text-neutral-500">
                                        or continue with
                                    </div>
                                </div>
                            </div>

                            <div className="my-4 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
                                {items.map((item) => (
                                    <FormField
                                        key={item.id}
                                        control={form.control}
                                        name={`items.${item.id}`}
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col space-y-2 rounded-lg border bg-neutral-50 p-2 transition-all hover:border-primary-200 hover:bg-primary-50">
                                                <div className="flex items-start justify-between">
                                                    <FormLabel className="text-sm font-normal">
                                                        {item.label === 'Assess' && (
                                                            <VacademyAssessLogo className="w-[150px] sm:w-[200px]" />
                                                        )}
                                                        {item.label === 'LMS' && (
                                                            <VacademyLMSLogo className="w-[150px] sm:w-[200px]" />
                                                        )}
                                                        {item.label === 'Volt' && (
                                                            <VacademyVoltLogo />
                                                        )}
                                                        {item.label === 'Vsmart' && (
                                                            <VacademyVSmartLogo />
                                                        )}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                            className={`size-5 border shadow-none ${
                                                                field.value
                                                                    ? 'border-none bg-green-500 text-white'
                                                                    : 'bg-white'
                                                            }`}
                                                        />
                                                    </FormControl>
                                                </div>
                                                <p className="text-xs text-neutral-500">
                                                    {item.description}
                                                </p>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        <MyButton
                            type="submit"
                            scale="large"
                            buttonType="primary"
                            layoutVariant="default"
                            onClick={() =>
                                navigate({
                                    to: '/signup/onboarding',
                                    search: {
                                        assess: form.getValues('items').assess ?? false,
                                        lms: form.getValues('items').lms ?? false,
                                        volt: form.getValues('items').volt ?? false,
                                        vsmart: form.getValues('items').vsmart ?? false,
                                    },
                                })
                            }
                            disable={!form.formState.isValid}
                        >
                            <Plus size={32} />
                            Create Free Account
                        </MyButton>

                        <p className="text-sm text-neutral-500">
                            Already have an account?{' '}
                            <span
                                className="cursor-pointer text-primary-500"
                                onClick={() => navigate({ to: '/login' })}
                            >
                                Login
                            </span>
                        </p>
                    </form>
                </Form>
            </div>
        </div>
    );
}
