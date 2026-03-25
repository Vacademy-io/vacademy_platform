import { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { Warning, ArrowClockwise } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { useTheme } from '@/providers/theme/theme-provider';
import { getCachedInstituteBranding, getPublicUrl } from '@/services/domain-routing';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-orange-50 px-6 py-12 text-center">
                    <div className="mb-6 rounded-full bg-red-100 p-4">
                        <Warning className="size-12 text-red-600" />
                    </div>

                    <h2 className="mb-3 text-xl font-semibold text-neutral-800">
                        Something went wrong
                    </h2>

                    <p className="mb-6 max-w-md text-sm leading-relaxed text-neutral-600">
                        We encountered an unexpected error while loading this content. This might be
                        due to a temporary issue or insufficient permissions.
                    </p>

                    <div className="flex flex-col items-center gap-3 sm:flex-row">
                        <MyButton
                            onClick={this.handleReset}
                            buttonType="primary"
                            scale="medium"
                            className="flex items-center gap-2"
                        >
                            <ArrowClockwise className="size-4" />
                            Try Again
                        </MyButton>

                        <MyButton
                            onClick={() => window.location.reload()}
                            buttonType="secondary"
                            scale="medium"
                        >
                            Reload Page
                        </MyButton>
                    </div>

                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <details className="mt-6 max-w-full overflow-auto rounded-lg bg-red-100 p-4 text-left">
                            <summary className="mb-2 cursor-pointer text-sm font-medium text-red-800">
                                Error Details (Development)
                            </summary>
                            <pre className="whitespace-pre-wrap break-words text-xs text-red-700">
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

// Vacademy Logo Component (fallback)
const VacademyLogoSVG = ({ className = '' }: { className?: string }) => (
    <svg className={className} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect
            x="258.938"
            y="427.189"
            width="104.187"
            height="348.192"
            rx="52.0933"
            transform="rotate(-143.162 258.938 427.189)"
            fill="#ED7424"
            stroke="#ED7424"
        />
        <rect
            x="-0.163552"
            y="0.687932"
            width="104.187"
            height="186.707"
            rx="52.0933"
            transform="matrix(0.851484 -0.52438 -0.52438 -0.851484 142.718 299.424)"
            fill="#ED7424"
            stroke="#ED7424"
        />
    </svg>
);

// Logo Component (Institute or Vacademy)
const Logo = ({ className = '' }: { className?: string }) => {
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoLoaded, setLogoLoaded] = useState(false);
    const [isResolving, setIsResolving] = useState(true);

    useEffect(() => {
        const loadLogo = async () => {
            const cachedBranding = getCachedInstituteBranding();

            // First try the already resolved URL
            if (cachedBranding?.instituteLogoUrl) {
                setLogoUrl(cachedBranding.instituteLogoUrl);
                setIsResolving(false);
                return;
            }

            // If no URL but we have a fileId, resolve it
            if (cachedBranding?.instituteLogoFileId) {
                const resolvedUrl = await getPublicUrl(cachedBranding.instituteLogoFileId);
                if (resolvedUrl) {
                    setLogoUrl(resolvedUrl);
                    setIsResolving(false);
                    return;
                }
            }

            // No logo available, show fallback
            setIsResolving(false);
            setLogoLoaded(true);
        };

        loadLogo();
    }, []);

    // Still resolving the logo URL
    if (isResolving) {
        return <div className={className} />;
    }

    // We have a URL and it hasn't loaded yet
    if (logoUrl && !logoLoaded) {
        return (
            <img
                src={logoUrl}
                alt="Logo"
                className={className}
                onLoad={() => setLogoLoaded(true)}
                onError={() => {
                    setLogoUrl(null);
                    setLogoLoaded(true);
                }}
            />
        );
    }

    // Logo loaded successfully
    if (logoUrl && logoLoaded) {
        return <img src={logoUrl} alt="Logo" className={className} />;
    }

    // Fallback to Vacademy logo
    return <VacademyLogoSVG className={className} />;
};

// Main dashboard loader component
export const DashboardLoader = ({
    height = '',
    fullscreen = false,
}: {
    height?: string;
    size?: number;
    fullscreen?: boolean;
}) => {
    const { getPrimaryColorCode } = useTheme();
    const [loaderColor, setLoaderColor] = useState<string>(getPrimaryColorCode());
    const containerMinHeight = height || '100%';

    useEffect(() => {
        const cachedBranding = getCachedInstituteBranding();
        if (cachedBranding?.instituteThemeCode) {
            setLoaderColor(cachedBranding.instituteThemeCode);
        } else {
            setLoaderColor(getPrimaryColorCode());
        }
    }, [getPrimaryColorCode]);

    return (
        <div
            className={`${fullscreen ? 'fixed inset-0' : 'w-full'} flex items-center justify-center bg-background`}
            style={{ minHeight: containerMinHeight }}
        >
            <div className="flex flex-col items-center justify-center gap-4 px-4">
                {/* Logo */}
                <div className="relative">
                    <Logo className="size-16 object-contain sm:size-12 md:size-14" />
                </div>

                {/* Horizontal Progress Bar */}
                <div className="w-32 sm:w-40 md:w-48">
                    <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                                background: loaderColor,
                                animation: 'loading-progress 2s ease-in-out infinite',
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Animation Styles */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                        @keyframes loading-progress {
                            0% {
                                width: 0%;
                                margin-left: 0%;
                            }
                            50% {
                                width: 70%;
                                margin-left: 15%;
                            }
                            100% {
                                width: 0%;
                                margin-left: 100%;
                            }
                        }
                    `,
                }}
            />
        </div>
    );
};
