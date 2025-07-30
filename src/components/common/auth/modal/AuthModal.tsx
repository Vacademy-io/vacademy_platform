import { useState, useEffect, useRef } from "react";
import { ModalLoginForm } from "@/components/common/auth/login/sections/ModalLoginForm";
import { ModalSignUpForm } from "@/components/common/auth/signup/sections/ModalSignUpForm";
import { ModalForgotPasswordForm } from "@/components/common/auth/login/sections/ModalForgotPasswordForm";

interface AuthModalProps {
    type?: string;
    courseId?: string;
    trigger: React.ReactNode;
}

export function AuthModal({ type, courseId, trigger }: AuthModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMode, setCurrentMode] = useState<'login' | 'signup' | 'forgot-password'>('login');
    const [isVisible, setIsVisible] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('modal-open');
            document.documentElement.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
            document.documentElement.classList.remove('modal-open');
        }

        return () => {
            document.body.classList.remove('modal-open');
            document.documentElement.classList.remove('modal-open');
        };
    }, [isOpen]);

    // Animation and focus management
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                handleClose();
            }

            // Focus trapping
            if (event.key === 'Tab' && isOpen) {
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
    }, [isOpen]);

    const handleSwitchToSignup = () => {
        setCurrentMode('signup');
    };

    const handleSwitchToLogin = () => {
        setCurrentMode('login');
    };

    const handleSwitchToForgotPassword = () => {
        setCurrentMode('forgot-password');
    };

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            setIsOpen(false);
            // Reset to login mode when closing
            setCurrentMode('login');
        }, 200);
    };

    const handleBackdropClick = (event: React.MouseEvent) => {
        if (event.target === event.currentTarget) {
            handleClose();
        }
    };

    if (!isOpen) return <div onClick={() => setIsOpen(true)}>{trigger}</div>;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 modal-backdrop ${
                isVisible
                    ? 'bg-gray-200 bg-opacity-50 backdrop-blur'
                    : 'bg-opacity-0'
            }`}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            aria-describedby="auth-description"
        >
            <div
                ref={dialogRef}
                className={`relative bg-white rounded-2xl border-2 border-gray-200 shadow-2xl transition-all duration-200 transform ${
                    isVisible
                        ? 'scale-100 opacity-100 translate-y-0'
                        : 'scale-95 opacity-0 translate-y-4'
                } scrollbar-hide`}
                                style={{
                    width: '500px',
                    padding: '20px',
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    overflowY: 'scroll',
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Screen reader title */}
                <h1 id="auth-title" className="sr-only">
                    {currentMode === 'login' ? 'Login Dialog' : currentMode === 'signup' ? 'Signup Dialog' : 'Forgot Password Dialog'}
                </h1>
                <p id="auth-description" className="sr-only">
                    {currentMode === 'login' 
                        ? 'Sign in to your account using social login or email and password'
                        : currentMode === 'signup'
                        ? 'Create your account by providing your email, full name, and username'
                        : 'Reset your password by entering your email address'
                    }
                </p>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute text-gray-400 hover:text-gray-600 text-3xl font-light focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full transition-colors"
                    style={{ top: '6px', right: '16px' }}
                    aria-label={`Close ${currentMode} dialog`}
                    type="button"
                >
                    ×
                </button>

                {/* Content */}
                <div className="mt-8">
                    {currentMode === 'login' ? (
                        <ModalLoginForm 
                            type={type} 
                            courseId={courseId}
                            onSwitchToSignup={handleSwitchToSignup}
                            onSwitchToForgotPassword={handleSwitchToForgotPassword}
                        />
                    ) : currentMode === 'signup' ? (
                        <ModalSignUpForm 
                            type={type} 
                            courseId={courseId}
                            onSwitchToLogin={handleSwitchToLogin}
                        />
                    ) : (
                        <ModalForgotPasswordForm 
                            onBackToLogin={handleSwitchToLogin}
                        />
                    )}
                </div>
            </div>
        </div>
    );
} 