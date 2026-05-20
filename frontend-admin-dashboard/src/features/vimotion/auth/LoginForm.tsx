import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
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
import { setAuthorizationCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { vimotionLogin } from '../api/signup';
import { VimotionLogoMark } from '../brand/VimotionLogoMark';
import { useVimotionDocumentChrome } from '../brand/useVimotionDocumentChrome';
import { useVimotionNativeShell } from '../native/useVimotionNativeShell';
import { OutputShowcase } from './OutputShowcase';

const loginSchema = z.object({
    email: z.string().trim().email('Enter a valid email'),
    password: z.string().min(1, 'Enter your password'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
    useVimotionDocumentChrome();
    useVimotionNativeShell();
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);

    const form = useForm<LoginValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    });

    const login = useMutation({
        mutationFn: (values: LoginValues) =>
            vimotionLogin({ email: values.email.trim(), password: values.password }),
        onSuccess: (data) => {
            setAuthorizationCookie(TokenKey.accessToken, data.accessToken);
            setAuthorizationCookie(TokenKey.refreshToken, data.refreshToken);
            toast.success('Welcome back');
            navigate({ to: '/vim/dashboard' });
        },
        onError: (err: unknown) => {
            const status = (err as { response?: { status?: number } })?.response?.status;
            const msg =
                status === 401
                    ? 'Email or password is incorrect'
                    : err instanceof Error
                      ? err.message
                      : 'Could not sign in';
            toast.error(msg);
        },
    });

    const onSubmit = (values: LoginValues) => login.mutate(values);

    return (
        <div className="pt-safe pb-safe grid min-h-screen w-screen grid-cols-1 bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <OutputShowcase
                tagline="Sign back in. Your studio is exactly how you left it."
                className="order-last lg:order-first"
            />

            <section className="flex min-h-screen flex-col">
                {/* Mobile-only top bar with the wordmark */}
                <div className="flex items-center gap-2 px-6 pt-6 lg:hidden">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
                        <VimotionLogoMark size={18} className="text-neutral-900" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight text-neutral-900">
                        Vimotion
                    </span>
                </div>

                <div className="flex flex-1 items-center justify-center bg-[#FAFAF7] px-4 py-12 sm:bg-white sm:px-10">
                    <div className="w-full max-w-md">
                        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
                            <div className="mb-6 space-y-1.5">
                                <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
                                    Sign in to Vimotion
                                </h1>
                                <p className="text-sm text-neutral-500">
                                    Welcome back. Enter your credentials below.
                                </p>
                            </div>

                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-sm font-medium text-neutral-700">
                                                    Email
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="email"
                                                        autoComplete="email"
                                                        placeholder="you@example.com"
                                                        className="h-11"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-sm font-medium text-neutral-700">
                                                    Password
                                                </FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input
                                                            type={
                                                                showPassword ? 'text' : 'password'
                                                            }
                                                            autoComplete="current-password"
                                                            placeholder="••••••••"
                                                            className="h-11 pr-10"
                                                            {...field}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setShowPassword((v) => !v)
                                                            }
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-400 hover:text-neutral-600"
                                                            aria-label={
                                                                showPassword
                                                                    ? 'Hide password'
                                                                    : 'Show password'
                                                            }
                                                        >
                                                            {showPassword ? (
                                                                <EyeOff className="size-4" />
                                                            ) : (
                                                                <Eye className="size-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Button
                                        type="submit"
                                        disabled={login.isPending}
                                        className="h-11 w-full gap-2 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
                                    >
                                        {login.isPending ? 'Signing in…' : 'Sign in'}
                                        {!login.isPending && <ArrowRight className="size-4" />}
                                    </Button>
                                </form>
                            </Form>

                            <p className="mt-6 text-center text-sm text-neutral-500">
                                New to Vimotion?{' '}
                                <Link
                                    to="/vim/onboarding"
                                    className="font-medium text-neutral-900 hover:underline"
                                >
                                    Create an account
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>

                <p className="px-6 pb-6 text-center text-xs text-neutral-400 sm:px-10">
                    By continuing, you agree to Vimotion&rsquo;s Terms and Privacy Policy.
                </p>
            </section>
        </div>
    );
}
