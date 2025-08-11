import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ModalSpecificLoginForm } from "@/components/common/auth/login/forms/modal/ModalSpecificLoginForm";
import { ModalSignUpForm } from "@/components/common/auth/signup/forms/modal/ModalSignUpForm";
import { ModalForgotPasswordForm } from "@/components/common/auth/login/forms/modal/ModalForgotPasswordForm";

interface AuthModalProps {
    type?: string;
    courseId?: string;
    trigger: React.ReactNode;
    onModalOpen?: () => void;
    onLoginSuccess?: () => void;
    onSignupSuccess?: () => void;
}

export function AuthModal({ type, courseId, trigger, onModalOpen, onLoginSuccess, onSignupSuccess }: AuthModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMode, setCurrentMode] = useState<'login' | 'signup' | 'forgot-password'>('login');
    const [isVisible, setIsVisible] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    // Determine the current route context for login redirection
    const getCurrentRouteContext = () => {
        const currentPath = window.location.pathname;
        const currentSearch = window.location.search;
        
        // If type and courseId are explicitly provided, use them
        if (type && courseId) {
            return { type, courseId, instituteId: undefined };
        }
        
        // Extract parameters from URL
        const urlParams = new URLSearchParams(currentSearch);
        const urlType = urlParams.get('type');
        const urlCourseId = urlParams.get('courseId');
        const urlInstituteId = urlParams.get('instituteId');
        
        // Otherwise, determine based on current route
        if (currentPath.includes("/courses/course-details")) {
            const courseIdFromUrl = urlParams.get("courseId");
            if (courseIdFromUrl) {
                return { 
                    type: urlType || "courseDetailsPage", 
                    courseId: courseIdFromUrl,
                    instituteId: urlInstituteId || undefined
                };
            }
        } else if (currentPath.includes("/courses")) {
            return { 
                type: urlType || "courseDetailsPage", 
                courseId: urlCourseId || undefined,
                instituteId: urlInstituteId || undefined
            };
        }
        
        // Default case - use URL parameters if available
        return { 
            type: urlType || undefined, 
            courseId: urlCourseId || undefined,
            instituteId: urlInstituteId || undefined
        };
    };

    // Listen for postMessage from OAuth tab to switch to signup modal
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Only accept messages from the same origin
            if (event.origin !== window.location.origin) return;
            
            const { action, type: oauthType, courseId: oauthCourseId, instituteId, fromOAuth } = event.data;
            
            if (action === 'openSignupModal' && fromOAuth) {
                // Update the modal context with OAuth parameters
                const newUrl = new URL(window.location.href);
                if (oauthType) newUrl.searchParams.set('type', oauthType);
                if (oauthCourseId) newUrl.searchParams.set('courseId', oauthCourseId);
                if (instituteId) newUrl.searchParams.set('instituteId', instituteId);
                newUrl.searchParams.set('fromOAuth', 'true');
                window.history.replaceState({}, '', newUrl.toString());
                
                // Switch to signup mode
                setCurrentMode('signup');
                
                // Ensure modal is open
                if (!isOpen) {
                    setIsOpen(true);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [isOpen]);

    // Check for closeModal parameter and close modal if present
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const closeModal = urlParams.get('closeModal');
        
        if (closeModal === 'true' && isOpen) {
            handleClose();
            // Remove the closeModal parameter from URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('closeModal');
            window.history.replaceState({}, '', newUrl.toString());
        }
    }, [isOpen]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        let scrollY = 0;
        let preventScrollHandler: ((e: Event) => boolean) | null = null;
        
        if (isOpen) {
            // Store current scroll position
            scrollY = window.scrollY;
            
            // Add classes for styling
            document.body.classList.add('modal-open');
            document.documentElement.classList.add('modal-open');
            
            // Prevent scrolling by setting overflow hidden and position fixed
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.height = '100%';
            
            // Also prevent scrolling on html element
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.style.height = '100%';
            
            // Prevent scrolling on background elements only, allow modal scrolling
            preventScrollHandler = (e: Event) => {
                const target = e.target as Element;
                const modalContent = dialogRef.current;
                
                // Allow scrolling within the modal content
                if (modalContent && (modalContent.contains(target) || modalContent === target)) {
                    return true;
                }
                
                // Prevent scrolling on background elements
                e.preventDefault();
                e.stopPropagation();
                return false;
            };
            
            // Add event listeners to prevent scroll
            document.addEventListener('wheel', preventScrollHandler, { passive: false });
            document.addEventListener('touchmove', preventScrollHandler, { passive: false });
            
        } else {
            // Restore scrolling
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.documentElement.style.overflow = '';
            document.documentElement.style.height = '';
            
            // Restore scroll position
            window.scrollTo(0, scrollY);
            
            // Remove classes
            document.body.classList.remove('modal-open');
            document.documentElement.classList.remove('modal-open');
            
            // Remove event listeners
            if (preventScrollHandler) {
                document.removeEventListener('wheel', preventScrollHandler);
                document.removeEventListener('touchmove', preventScrollHandler);
            }
        }

        return () => {
            // Cleanup on unmount
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.documentElement.style.overflow = '';
            document.documentElement.style.height = '';
            document.body.classList.remove('modal-open');
            document.documentElement.classList.remove('modal-open');
            
            if (preventScrollHandler) {
                document.removeEventListener('wheel', preventScrollHandler);
                document.removeEventListener('touchmove', preventScrollHandler);
            }
        };
    }, [isOpen]);

    // Animation and focus management
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            // Focus the modal content for accessibility
            setTimeout(() => {
                dialogRef.current?.focus();
            }, 100);
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

    const handleLoginSuccess = () => {
        // Close the modal after successful login
        handleClose();
        // Call the callback if provided
        if (onLoginSuccess) {
            onLoginSuccess();
        }
    };

    const handleSignupSuccess = () => {
        // Close the modal after successful signup
        handleClose();
        // Call the callback if provided
        if (onSignupSuccess) {
            onSignupSuccess();
        }
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

    if (!isOpen) {
        return <div onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
            // Call the optional callback when modal opens, but delay it slightly
            if (onModalOpen) {
                setTimeout(() => {
                    onModalOpen();
                }, 0);
            }
        }}>{trigger}</div>;
    }

    const modalContent = (
        <div
            className={`fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 transition-all duration-200 modal-backdrop ${
                isVisible
                    ? 'bg-gray-200 bg-opacity-50 backdrop-blur'
                    : 'bg-opacity-0'
            }`}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                visibility: 'visible',
                opacity: isVisible ? 1 : 0
            }}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            aria-describedby="auth-description"
            data-testid="auth-modal-backdrop"
        >
            <div
                ref={dialogRef}
                className={`relative bg-white rounded-2xl border-2 border-gray-200 shadow-2xl transition-all duration-200 transform ${
                    isVisible
                        ? 'scale-100 opacity-100 translate-y-0'
                        : 'scale-95 opacity-0 translate-y-4'
                } scrollbar-hide auth-modal-content w-full max-w-[500px] mx-4 sm:mx-6`}
                style={{
                    padding: '16px',
                    maxHeight: '90vh',
                    minHeight: 'auto',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none',
                    zIndex: 100000,
                    position: 'relative',
                    display: 'block',
                    visibility: 'visible',
                    opacity: isVisible ? 1 : 0
                }}
                onClick={(e) => e.stopPropagation()}
                data-testid="auth-modal-content"
                tabIndex={-1}
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
                <div className="mt-8 w-full pb-4">
                    {currentMode === 'login' ? (
                        <ModalSpecificLoginForm 
                            type={getCurrentRouteContext().type} 
                            courseId={getCurrentRouteContext().courseId}
                            onSwitchToSignup={handleSwitchToSignup}
                            onSwitchToForgotPassword={handleSwitchToForgotPassword}
                            onLoginSuccess={handleLoginSuccess}
                        />
                    ) : currentMode === 'signup' ? (
                        <ModalSignUpForm 
                            type={getCurrentRouteContext().type} 
                            courseId={getCurrentRouteContext().courseId}
                            instituteId={getCurrentRouteContext().instituteId}
                            onSwitchToLogin={handleSwitchToLogin}
                            onSignupSuccess={handleSignupSuccess}
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

    return createPortal(modalContent, document.body);
} 