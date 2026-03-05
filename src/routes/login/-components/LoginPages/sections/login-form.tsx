import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { getInstituteId } from '@/constants/helper';
import { hasFacultyAssignedPermission } from '@/lib/auth/facultyAccessUtils';
import { MyInput } from '@/components/design-system/input';
import { MyButton } from '@/components/design-system/button';
import { Link } from '@tanstack/react-router';
import { loginSchema } from '@/schemas/login/login';
import { useEffect } from 'react';
// Removed split-screen splash layout to center the login component
import { loginUser, loginResponseSchema } from '@/hooks/login/login-button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAnimationStore } from '@/stores/login/animationStore';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { useNavigate } from '@tanstack/react-router';
import { handleSSOLogin } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
// import { Link2Icon } from 'lucide-react';
import { handleOAuthLogin } from '@/hooks/login/oauth-login';
import { GitHubIcon } from '@/components/icons/GitHubIcon';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { EmailLogin } from './EmailOtpForm';
import { useState } from 'react';
import { amplitudeEvents, trackEvent } from '@/lib/amplitude';
import { InstituteSelection } from './InstituteSelection';
import { SubOrgSelection } from './SubOrgSelection';
import { getInstituteSelectionResult, setSelectedInstitute } from '@/lib/auth/instituteUtils';
import { getTokenFromCookie, getUserRoles } from '@/lib/auth/sessionUtility';
import { handleLoginFlow } from '@/lib/auth/loginFlowHandler';
import { getCachedInstituteBranding } from '@/services/domain-routing';
import useInstituteLogoStore from '@/components/common/layout-container/sidebar/institutelogo-global-zustand';
import { getDisplaySettings, getDisplaySettingsFromCache } from '@/services/display-settings';
import { ADMIN_DISPLAY_SETTINGS_KEY, TEACHER_DISPLAY_SETTINGS_KEY, CUSTOM_ROLE_DISPLAY_SETTINGS_KEY } from '@/types/display-settings';

type FormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
    const queryClient = useQueryClient();
    const { hasSeenAnimation, setHasSeenAnimation } = useAnimationStore();
    const navigate = useNavigate();
    const { instituteLogo } = useInstituteLogoStore();
    const cachedBranding = getCachedInstituteBranding();
    const instituteName = cachedBranding?.instituteName;
    const portalRoleLabel = cachedBranding?.role === 'TEACHER' ? 'Teacher' : 'Admin';
    const portalInstitute = instituteName || 'Vacademy';
    const [isEmailLogin, setIsEmailLogin] = useState(false);
    const [providerFlags, setProviderFlags] = useState({
        allowGoogleAuth: true,
        allowGithubAuth: true,
        allowEmailOtpAuth: true,
        allowUsernamePasswordAuth: true,
    });
    const [allowSignup, setAllowSignup] = useState(false);
    const [showInstituteSelection, setShowInstituteSelection] = useState(false);
    const [showSubOrgSelection, setShowSubOrgSelection] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            username: '',
            password: '',
        },
        mode: 'onTouched',
    });

    useEffect(() => {
        if (!hasSeenAnimation) {
            setTimeout(() => {
                setHasSeenAnimation();
            }, 8000);
        }
    }, [hasSeenAnimation, setHasSeenAnimation]);

    useEffect(() => {
        // Initialize auth provider toggles and signup visibility from cached branding
        try {
            const cached = getCachedInstituteBranding();
            if (cached) {
                setProviderFlags({
                    allowGoogleAuth: cached.allowGoogleAuth !== false,
                    allowGithubAuth: cached.allowGithubAuth !== false,
                    allowEmailOtpAuth: cached.allowEmailOtpAuth !== false,
                    allowUsernamePasswordAuth: cached.allowUsernamePasswordAuth !== false,
                });
                setAllowSignup(cached.allowSignup !== false);

                // Prefer email login if username/password is disabled
                if (
                    cached.allowUsernamePasswordAuth === false &&
                    cached.allowEmailOtpAuth !== false
                ) {
                    setIsEmailLogin(true);
                }
            }
        } catch (_e) {
            // ignore
        }

        // Check for error parameters from OAuth
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const showInstituteSelection = urlParams.get('showInstituteSelection');
        const showSubOrgSelection = urlParams.get('showSubOrgSelection');

        if (error === 'student_access_denied') {
            toast.error('Access Denied', {
                description:
                    'Students are not allowed to access the admin portal. Please contact your administrator.',
                className: 'error-toast',
                duration: 5000,
            });
            return;
        }

        if (error === 'admin_role_required') {
            toast.error('Access Denied', {
                description:
                    'This portal requires ADMIN privileges. Please contact your administrator.',
                className: 'error-toast',
                duration: 5000,
            });
            return;
        }

        // Check if we should show institute selection from URL parameter
        if (showInstituteSelection === 'true') {
            setShowInstituteSelection(true);
            return;
        }

        // Check if we should show sub-org selection from URL parameter
        if (showSubOrgSelection === 'true') {
            setShowSubOrgSelection(true);
            return;
        }

        // Handle SSO login from URL parameters
        const ssoLoginSuccess = handleSSOLogin();

        if (ssoLoginSuccess) {
            // Track SSO login success
            amplitudeEvents.signIn('sso');
            trackEvent('Login Success', {
                login_method: 'sso',
                timestamp: new Date().toISOString(),
            });

            // Use centralized login flow for SSO
            const cookieAccessToken = getTokenFromCookie(TokenKey.accessToken);
            const cookieRefreshToken = getTokenFromCookie(TokenKey.refreshToken);

            if (cookieAccessToken && cookieRefreshToken) {
                setTimeout(async () => {
                    try {
                        const result = await handleLoginFlow({
                            loginMethod: 'sso',
                            accessToken: cookieAccessToken,
                            refreshToken: cookieRefreshToken,
                            queryClient,
                        });

                        if (!result.success) {
                            const errorMessage =
                                result.error === 'admin_role_required'
                                    ? 'This portal requires ADMIN privileges. Please contact your administrator.'
                                    : 'Students are not allowed to access the admin portal. Please contact your administrator.';

                            toast.error('Access Denied', {
                                description: errorMessage,
                                className: 'error-toast',
                                duration: 5000,
                            });
                            return;
                        }

                        if (result.shouldShowInstituteSelection) {
                            setShowInstituteSelection(true);
                            return;
                        }

                        if (result.shouldShowSubOrgSelection) {
                            setShowSubOrgSelection(true);
                            return;
                        }

                        const redirectUrl = result.redirectUrl || '/dashboard';
                        navigate({ to: redirectUrl });
                    } catch (error) {
                        console.error('SSO login flow error:', error);
                        toast.error('Login failed. Please try again.');
                    }
                }, 100);
            }
            return;
        }

        const accessToken = urlParams.get('accessToken');
        const refreshToken = urlParams.get('refreshToken');

        if (accessToken && refreshToken) {
            // Use centralized login flow for OAuth
            setTimeout(async () => {
                try {
                    const result = await handleLoginFlow({
                        loginMethod: 'oauth',
                        accessToken,
                        refreshToken,
                        queryClient,
                    });

                    if (!result.success) {
                        const errorMessage =
                            result.error === 'admin_role_required'
                                ? 'This portal requires ADMIN privileges. Please contact your administrator.'
                                : 'Students are not allowed to access the admin portal. Please contact your administrator.';

                        toast.error('Access Denied', {
                            description: errorMessage,
                            className: 'error-toast',
                            duration: 5000,
                        });
                        return;
                    }

                    if (result.shouldShowInstituteSelection) {
                        setShowInstituteSelection(true);
                        return;
                    }

                    if (result.shouldShowSubOrgSelection) {
                        setShowSubOrgSelection(true);
                        return;
                    }

                    const redirectUrl = result.redirectUrl || '/dashboard';
                    navigate({ to: redirectUrl });
                } catch (error) {
                    console.error('OAuth login flow error:', error);
                    toast.error('Login failed. Please try again.');
                }
            }, 100);
        } else {
            // Check if we have tokens in cookies and need to show institute selection
            const cookieAccessToken = getTokenFromCookie(TokenKey.accessToken);
            if (cookieAccessToken) {
                // Check if user needs to select an institute
                const instituteResult = getInstituteSelectionResult();

                if (instituteResult.shouldShowSelection) {
                    setShowInstituteSelection(true);
                    return;
                }
            }
        }
    }, [navigate, queryClient]);

    const handlePostLoginRedirect = async (accessToken: string, refreshToken: string) => {
        try {
            // Use centralized login flow
            const result = await handleLoginFlow({
                loginMethod: 'username_password',
                accessToken,
                refreshToken,
                queryClient,
            });

            if (!result.success) {
                // User was blocked or error occurred
                const errorMessage =
                    result.error === 'admin_role_required'
                        ? 'This portal requires ADMIN privileges. Please contact your administrator.'
                        : 'Students are not allowed to access the admin portal. Please contact your administrator.';

                toast.error('Access Denied', {
                    description: errorMessage,
                    className: 'error-toast',
                    duration: 5000,
                });
                return;
            }

            if (result.shouldShowInstituteSelection) {
                setShowInstituteSelection(true);
                return;
            }

            if (result.shouldShowSubOrgSelection) {
                setShowSubOrgSelection(true);
                return;
            }

            // Navigate to the appropriate URL
            const redirectUrl = result.redirectUrl || '/dashboard';
            navigate({ to: redirectUrl });
        } catch (error) {
            console.error('Login flow error:', error);
            toast.error('Login failed. Please try again.');
        }
    };

    const mutation = useMutation({
        mutationFn: (values: FormValues) => loginUser(values.username, values.password),
        onSuccess: (response: z.infer<typeof loginResponseSchema>) => {
            if (response) {
                // Track successful login
                amplitudeEvents.signIn('username_password');

                // Add a small delay to ensure tokens are properly set before navigation
                setTimeout(() => {
                    handlePostLoginRedirect(response.accessToken, response.refreshToken);
                }, 100);
            } else {
                // Track failed login
                trackEvent('Login Failed', {
                    login_method: 'username_password',
                    error_reason: 'invalid_credentials',
                    timestamp: new Date().toISOString(),
                });

                toast.error('Login Error', {
                    description: 'Invalid credentials',
                    className: 'error-toast',
                    duration: 3000,
                });
            }
        },
        onError: (error: Error) => {
            // Track login error
            trackEvent('Login Failed', {
                login_method: 'username_password',
                error_reason: 'network_error',
                error_message: error?.message || 'Unknown error',
                timestamp: new Date().toISOString(),
            });

            toast.error('Login Error', {
                description: 'Invalid username or password',
                className: 'error-toast',
                duration: 3000,
            });
        },
    });

    function onSubmit(values: FormValues) {
        mutation.mutate(values);
    }

    const handleNavigateSignup = () => {
        navigate({ to: '/signup' });
    };

    // const handleNavigateAiEvaluator = () => {
    //     navigate({ to: '/evaluator-ai' });
    // };

    const handleSwitchToEmail = () => {
        setIsEmailLogin(true);
    };

    const handleSwitchToUsername = () => {
        setIsEmailLogin(false);
    };

    const handleInstituteSelect = async (instituteId: string) => {
        setSelectedInstitute(instituteId);
        setShowInstituteSelection(false);

        // Check if we need to show sub-org selection after institute selection
        const { handleInstituteSelection } = await import('@/lib/auth/loginFlowHandler');
        const result = await handleInstituteSelection(instituteId);

        if (result.shouldShowSubOrgSelection) {
            setShowSubOrgSelection(true);
            return;
        }

        // Navigate to the appropriate route returned by the handleInstituteSelection utility
        if (result.redirectUrl) {
            console.log('🔍 LOGIN FORM DEBUG: Final redirect URL from utility:', result.redirectUrl);
            navigate({ to: result.redirectUrl });
            return;
        }

        // Fallback to display settings if for some reason redirectUrl is missing
        try {
            const accessToken = getTokenFromCookie(TokenKey.accessToken);
            const roles = getUserRoles(accessToken);
            const isAdminRole = roles.includes('ADMIN');
            const hasFaculty = hasFacultyAssignedPermission(getInstituteId());
    const roleKey = getActiveRoleDisplaySettingsKey();

            let ds: { postLoginRedirectRoute?: string } | null = getDisplaySettingsFromCache(roleKey);

            // If not in cache, we could fetch it, but handleLoginFlow/handleInstituteSelection should have handled it.
            // For safety, fallback to /dashboard if absolutely nothing is found.
            const redirectUrl = ds?.postLoginRedirectRoute || '/dashboard';
            console.log('🔍 LOGIN FORM DEBUG: Fallback redirect URL:', redirectUrl);
            navigate({ to: redirectUrl });
        } catch (error) {
            console.warn('Unexpected error in institute selection handler fallback:', error);
            navigate({ to: '/dashboard' });
        }
    };

    // Show sub-org selection if needed
    if (showSubOrgSelection) {
        return (
            <SubOrgSelection
                onSubOrgSelect={(subOrgId) => {
                    // After sub-org selection, we can finally redirect to dashboard
                    // The sub-org ID is already saved in localStorage by the component
                    handleInstituteSelect(getCachedInstituteBranding()?.instituteId || '');
                }}
            />
        );
    }

    // Show institute selection if needed
    if (showInstituteSelection) {
        return <InstituteSelection onInstituteSelect={handleInstituteSelect} />;
    }

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-neutral-50 px-4 py-6 sm:px-6 sm:py-8">
            {/* Decorative background elements - subtle bars, hidden on mobile */}
            <div className="pointer-events-none absolute inset-0 hidden md:block">
                <div className="absolute left-0 top-20 h-32 w-64 bg-primary-100/20"></div>
                <div className="absolute right-0 top-1/3 h-48 w-72 bg-neutral-200/30"></div>
                <div className="absolute bottom-32 left-1/4 h-24 w-96 bg-primary-50/15"></div>
                <div className="absolute right-1/3 top-1/2 h-40 w-56 bg-neutral-300/20"></div>
            </div>

            <div className="relative z-10 w-full max-w-5xl">
                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg md:rounded-2xl md:shadow-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        {/* Left side - Branding */}
                        <div className="flex flex-col items-center justify-center border-b border-neutral-200 bg-neutral-50/50 p-6 sm:p-8 md:border-b-0 md:border-r md:p-12">
                            {instituteLogo ? (
                                <img
                                    src={instituteLogo}
                                    alt="institute logo"
                                    className="mb-4 max-h-16 max-w-[160px] object-contain sm:mb-6 sm:max-h-20 sm:max-w-[200px]"
                                />
                            ) : null}
                            {instituteName ? (
                                <div className="mb-2 text-lg font-bold text-neutral-900 sm:mb-4 sm:text-xl">
                                    {instituteName}
                                </div>
                            ) : null}
                        </div>

                        {/* Right side - Login form */}
                        <div className="flex flex-col justify-center p-6 sm:p-8 md:p-12">
                            <div className="flex w-full flex-col gap-4">
                                {providerFlags.allowGoogleAuth && (
                                    <button
                                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 transition-all hover:border-neutral-400 hover:bg-neutral-50"
                                        onClick={() => {
                                            trackEvent('OAuth Login Initiated', {
                                                provider: 'google',
                                                action: 'login',
                                                timestamp: new Date().toISOString(),
                                            });
                                            handleOAuthLogin('google', { isSignup: false });
                                        }}
                                        type="button"
                                    >
                                        <GoogleIcon size={20} />
                                        Continue with Google
                                    </button>
                                )}
                                {providerFlags.allowGithubAuth && (
                                    <button
                                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 transition-all hover:border-neutral-400 hover:bg-neutral-50"
                                        onClick={() => {
                                            trackEvent('OAuth Login Initiated', {
                                                provider: 'github',
                                                action: 'login',
                                                timestamp: new Date().toISOString(),
                                            });
                                            handleOAuthLogin('github', { isSignup: false });
                                        }}
                                        type="button"
                                    >
                                        <GitHubIcon className="size-5" />
                                        Continue with GitHub
                                    </button>
                                )}

                                {(providerFlags.allowGoogleAuth ||
                                    providerFlags.allowGithubAuth) && (
                                        <div className="relative my-1 flex items-center justify-center">
                                            <div className="absolute inset-0 flex items-center">
                                                <span className="w-full border-t border-neutral-300" />
                                            </div>
                                            <div className="relative bg-white px-3 text-xs font-medium text-neutral-600">
                                                or continue with
                                            </div>
                                        </div>
                                    )}

                                {isEmailLogin ? (
                                    <EmailLogin onSwitchToUsername={handleSwitchToUsername} />
                                ) : (
                                    <Form {...form}>
                                        <form
                                            onSubmit={form.handleSubmit(onSubmit)}
                                            className="w-full space-y-4"
                                        >
                                            <FormField
                                                control={form.control}
                                                name="username"
                                                render={({
                                                    field: { onChange, value, ...field },
                                                }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <MyInput
                                                                inputType="text"
                                                                inputPlaceholder="Enter your username"
                                                                input={value}
                                                                onChangeFunction={onChange}
                                                                error={
                                                                    form.formState.errors.username
                                                                        ?.message
                                                                }
                                                                required={true}
                                                                size="large"
                                                                label="Username"
                                                                {...field}
                                                                className="w-full"
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <div className="space-y-1">
                                                <FormField
                                                    control={form.control}
                                                    name="password"
                                                    render={({
                                                        field: { onChange, value, ...field },
                                                    }) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <MyInput
                                                                    inputType="password"
                                                                    inputPlaceholder="••••••••"
                                                                    input={value}
                                                                    onChangeFunction={onChange}
                                                                    error={
                                                                        form.formState.errors
                                                                            .password?.message
                                                                    }
                                                                    required={true}
                                                                    size="large"
                                                                    label="Password"
                                                                    {...field}
                                                                    className="w-full"
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <div className="flex items-center justify-end">
                                                    <Link to="/login/forgot-password">
                                                        <div className="hover:text-primary-700 cursor-pointer text-xs font-medium text-primary-600 transition-colors">
                                                            Forgot Password?
                                                        </div>
                                                    </Link>
                                                </div>
                                            </div>

                                            {providerFlags.allowEmailOtpAuth &&
                                                providerFlags.allowUsernamePasswordAuth && (
                                                    <div className="flex w-full items-center justify-center pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={handleSwitchToEmail}
                                                            className="hover:text-primary-700 cursor-pointer text-xs font-medium text-primary-600 transition-colors"
                                                        >
                                                            Prefer email login?
                                                        </button>
                                                    </div>
                                                )}

                                            <div className="flex flex-col items-center gap-2 pt-2">
                                                <MyButton
                                                    type="submit"
                                                    scale="large"
                                                    buttonType="primary"
                                                    layoutVariant="default"
                                                    disabled={mutation.isPending}
                                                >
                                                    {mutation.isPending ? 'Logging in...' : 'Login'}
                                                </MyButton>
                                                {allowSignup && (
                                                    <p className="text-xs text-neutral-700">
                                                        Don&apos;t have an account?&nbsp;&nbsp;
                                                        <span
                                                            className="hover:text-primary-700 cursor-pointer font-medium text-primary-600 transition-colors"
                                                            onClick={handleNavigateSignup}
                                                        >
                                                            Create One
                                                        </span>
                                                    </p>
                                                )}
                                            </div>
                                        </form>
                                    </Form>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {Boolean(cachedBranding?.termsAndConditionUrl) ||
                    Boolean(cachedBranding?.privacyPolicyUrl) ? (
                    <div className="mt-4 text-center text-xs text-neutral-600">
                        {cachedBranding?.termsAndConditionUrl ? (
                            <a
                                href={cachedBranding.termsAndConditionUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium transition-colors hover:text-primary-600"
                            >
                                Terms & Conditions
                            </a>
                        ) : null}
                        {cachedBranding?.termsAndConditionUrl &&
                            cachedBranding?.privacyPolicyUrl ? (
                            <span className="mx-2 text-neutral-400">•</span>
                        ) : null}
                        {cachedBranding?.privacyPolicyUrl ? (
                            <a
                                href={cachedBranding.privacyPolicyUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium transition-colors hover:text-primary-600"
                            >
                                Privacy Policy
                            </a>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
