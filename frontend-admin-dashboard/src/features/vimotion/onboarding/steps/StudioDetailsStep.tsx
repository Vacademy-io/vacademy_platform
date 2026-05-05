import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ColorPickerField } from '@/routes/manage-pages/-components/ColorPickerField';
import { ImageUploadField } from '@/routes/manage-pages/-components/ImageUploadField';
import { useVimotionOnboardingStore } from '../store';
import { studioSchema, type StudioValues } from '../schema';
import { COMPANY_SIZE_OPTIONS } from '../../constants';
import { vimotionSignup } from '../../api/signup';
import { setAuthorizationCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export function StudioDetailsStep() {
    const navigate = useNavigate();
    const { contact, signupToken, accountType, studio, setStudio, setStep, reset } =
        useVimotionOnboardingStore();

    const form = useForm<StudioValues>({
        resolver: zodResolver(studioSchema),
        defaultValues: studio,
    });

    const signup = useMutation({
        mutationFn: (values: StudioValues) =>
            vimotionSignup({
                signup_token: signupToken!,
                full_name: contact.fullName,
                email: contact.email,
                phone_number: contact.phoneNumber,
                password: contact.password,
                account_type: accountType ?? 'studio',
                studio_name: values.studioName,
                logo_file_id: values.logoFileId,
                brand_color: values.brandColor,
                company_size: values.companySize,
            }),
        onSuccess: (data) => {
            setAuthorizationCookie(TokenKey.accessToken, data.accessToken);
            setAuthorizationCookie(TokenKey.refreshToken, data.refreshToken);
            toast.success('Welcome to Vimotion!');
            reset();
            navigate({ to: '/vim/dashboard' });
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to create account';
            toast.error(msg);
        },
    });

    const onSubmit = (values: StudioValues) => {
        setStudio(values);
        signup.mutate(values);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                    control={form.control}
                    name="studioName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium text-neutral-700">
                                Studio name
                            </FormLabel>
                            <FormControl>
                                <Input placeholder="Acme Studio" className="h-11" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="companySize"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium text-neutral-700">
                                Team size
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select team size" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {COMPANY_SIZE_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
                    <p className="mb-3 text-sm font-medium text-neutral-700">
                        Brand <span className="text-neutral-400">(optional)</span>
                    </p>
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="logoFileId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <ImageUploadField
                                            label="Logo"
                                            value={field.value ?? ''}
                                            onChange={(url) => field.onChange(url)}
                                            placeholder="Upload your studio logo"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="brandColor"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <ColorPickerField
                                            label="Brand color"
                                            value={field.value}
                                            onChange={(color) => field.onChange(color)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <Button
                        type="submit"
                        disabled={signup.isPending}
                        className="h-11 w-full bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
                    >
                        {signup.isPending ? 'Creating account…' : 'Create studio'}
                    </Button>
                    <button
                        type="button"
                        className="text-sm text-neutral-500 hover:text-neutral-700"
                        onClick={() => setStep('account-type')}
                    >
                        ← Back
                    </button>
                </div>
            </form>
        </Form>
    );
}
