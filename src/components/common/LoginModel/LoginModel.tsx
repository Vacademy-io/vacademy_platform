// import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { SignUpModel } from '../SignUpModel/SignUpModel';
// export const Route = createFileRoute('/login/')({
//     component: Login,
// })

const loginSchema = z.object({
    email: z.string().email('Enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export function LoginModel({
    onClose,
    switchToSignUp
}: {
    onClose: () => void;
    switchToSignUp: () => void;
}) {
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const navigate = useNavigate();
    const dialogRef = useRef<HTMLDivElement>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormInputs>({
        resolver: zodResolver(loginSchema),
    });

    // Animation and focus management
    useEffect(() => {
        setIsVisible(true);

        // Focus first input after animation
        const timer = setTimeout(() => {
            firstInputRef.current?.focus();
        }, 150);

        return () => clearTimeout(timer);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClose();
            }

            // Focus trapping
            if (event.key === 'Tab') {
                const focusableElements = dialogRef.current?.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );

                if (focusableElements) {
                    const firstElement = focusableElements[0] as HTMLElement;
                    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

                    if (event.shiftKey && document.activeElement === firstElement) {
                        event.preventDefault();
                        lastElement.focus();
                    } else if (!event.shiftKey && document.activeElement === lastElement) {
                        event.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [])

    const onSubmit = async (data: LoginFormInputs) => {
        setIsLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log('Form Data:', data);
            // Navigate to home after successful login
            handleClose();
        } catch (error) {
            console.error('Login failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            onClose(); // instead of navigate
        }, 200);
    };

    const handleBackdropClick = (event: React.MouseEvent) => {
        if (event.target === event.currentTarget) {
            handleClose();
        }
    };

    const handleSocialLogin = (provider: string) => {
        console.log(`Login with ${provider}`);
        // Add your social login logic here
    };

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center  justify-center p-4 transition-all duration-200 ${isVisible
                    ? ' bg-gray-200 bg-opacity-0 backdrop-blur'
                    : ' bg-opacity-0'
                }`}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            aria-describedby="login-description"
        >
            <div
                ref={dialogRef}
                className={`relative bg-white rounded-2xl border-2 border-gray-200 shadow-2xl transition-all duration-200 transform ${isVisible
                        ? 'scale-100 opacity-100 translate-y-0'
                        : 'scale-95 opacity-0 translate-y-4'
                    }`}
                style={{ width: '400px', padding: '20px' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Screen reader title */}
                <h1 id="login-title" className="sr-only">Login Dialog</h1>
                <p id="login-description" className="sr-only">
                    Sign in to your account using social login or email and password
                </p>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute text-gray-400 hover:text-gray-600 text-3xl font-light focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full transition-colors"
                    style={{ top: '6px', right: '16px' }}
                    aria-label="Close login dialog"
                    type="button"
                >
                    ×
                </button>

                {/* Social Login Buttons */}
                <div className="space-y-3 mb-4 mt-8" role="group" aria-label="Social login options">
                    <button
                        type="button"
                        onClick={() => handleSocialLogin('Google')}
                        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        aria-label="Login with Google"
                    >
                        <img className="w-5 h-5" src="https://img.icons8.com/color/48/google-logo.png" alt="" />
                        <span className="text-gray-700 font-medium">Login with Google</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSocialLogin('GitHub')}
                        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        aria-label="Login with GitHub"
                    >
                        <img className="w-5 h-5" src="https://img.icons8.com/ios-glyphs/30/github.png" alt="" />
                        <span className="text-gray-700 font-medium">Login with Github</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSocialLogin('Email OTP')}
                        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        aria-label="Login with Email OTP"
                    >
                        <img className="w-5 h-5" src="https://img.icons8.com/color/48/gmail-new.png" alt="" />
                        <span className="text-gray-700 font-medium">Login with Email Otp</span>
                    </button>
                </div>

                {/* Divider */}
                <div className="relative mb-4" role="separator" aria-label="Or">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-gray-500">Or</span>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    {/* Email Field */}
                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-gray-700 mb-1"
                        >
                            Email<span className="text-red-500 ml-1" aria-label="required">*</span>
                        </label>
                        <input
                            id="email"
                            type="email"
                            {...register('email')}
                            // ref={firstInputRef}
                            placeholder="you@email.com"
                            autoComplete="email"
                            aria-invalid={errors.email ? 'true' : 'false'}
                            aria-describedby={errors.email ? 'email-error' : undefined}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                        {errors.email && (
                            <p id="email-error" className="text-red-500 text-xs mt-1" role="alert">
                                {errors.email.message}
                            </p>
                        )}
                    </div>

                    {/* Password Field */}
                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-gray-700 mb-1"
                        >
                            Password<span className="text-red-500 ml-1" aria-label="required">*</span>
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter your password"
                                {...register('password')}
                                autoComplete="current-password"
                                aria-invalid={errors.password ? 'true' : 'false'}
                                aria-describedby={errors.password ? 'password-error' : 'password-help'}
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                tabIndex={0}
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <p id="password-help" className="sr-only">
                            Password must be at least 6 characters long
                        </p>
                        {errors.password && (
                            <p id="password-error" className="text-red-500 text-xs mt-1" role="alert">
                                {errors.password.message}
                            </p>
                        )}
                    </div>

                    {/* Forgot Password Link */}
                    <div className="text-right">
                        <Link
                            to="/"
                            className="text-sm text-blue-500 hover:text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors"
                            onClick={handleClose}
                        >
                            Forgot Password?
                        </Link>
                    </div>

                    {/* Login Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        aria-describedby="login-button-help"
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div
                                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                                    aria-hidden="true"
                                ></div>
                                <span>Logging in...</span>
                            </div>
                        ) : (
                            'Login'
                        )}
                    </button>
                    <p id="login-button-help" className="sr-only">
                        Press Enter or click to submit the login form
                    </p>
                </form>

                {/* Create Account Link */}
                <div className="mt-2 text-center  text-gray-600">
                    Don't have an account?{' '}
                    <Link

                        className="text-blue-500 hover:text-blue-600 hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors"
                        onClick={() => {
                            
                            switchToSignUp(); // switch modal
                        }}
                    >
                        Create Account
                    </Link>
                </div>
            </div>
        </div>
    );
}

//export default Login;

