import {
  Component,
  ErrorInfo,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { Warning, ArrowClockwise } from "@phosphor-icons/react";
import { MyButton } from "@/components/design-system/button";
import { useTheme } from "@/providers/theme/theme-provider";
import {
  getCachedInstituteBranding,
  getPublicUrl,
} from "@/services/domain-routing";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(
    error: Error
  ): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
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
            We encountered an unexpected error while loading this content. This
            might be due to a temporary issue or insufficient permissions.
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

          {process.env.NODE_ENV === "development" &&
            this.state.error && (
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

const VacademyLogoSVG = ({
  className = "",
}: {
  className?: string;
}) => (
  <svg
    className={className}
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>Loading</title>
    <circle cx="40" cy="40" r="32" fill="#F8FAFC" />
    <circle
      cx="40"
      cy="40"
      r="28"
      stroke="#E2E8F0"
      strokeWidth="4"
      strokeDasharray="4 12"
      strokeLinecap="round"
      opacity="0.7"
    />
    <circle
      cx="40"
      cy="40"
      r="28"
      stroke="#6366F1"
      strokeWidth="4"
      strokeLinecap="round"
      strokeDasharray="60 110"
      transform="rotate(-90 40 40)"
    />
    <circle cx="40" cy="40" r="6" fill="#6366F1" opacity="0.6" />
  </svg>
);

const Logo = ({ className = "" }: { className?: string }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    const loadLogo = async () => {
      const cachedBranding = getCachedInstituteBranding();

      if (cachedBranding?.instituteLogoUrl) {
        setLogoUrl(cachedBranding.instituteLogoUrl);
        setIsResolving(false);
        return;
      }

      if (cachedBranding?.instituteLogoFileId) {
        const resolvedUrl = await getPublicUrl(
          cachedBranding.instituteLogoFileId
        );
        if (resolvedUrl) {
          setLogoUrl(resolvedUrl);
          setIsResolving(false);
          return;
        }
      }

      setIsResolving(false);
      setLogoLoaded(true);
    };

    loadLogo();
  }, []);

  if (isResolving) {
    return <div className={className} />;
  }

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

  if (logoUrl && logoLoaded) {
    return <img src={logoUrl} alt="Logo" className={className} />;
  }

  return <VacademyLogoSVG className={className} />;
};

interface DashboardLoaderProps {
  height?: string;
  fullscreen?: boolean;
}

export const DashboardLoader = ({
  height = "",
  fullscreen = false,
}: DashboardLoaderProps) => {
  const { getPrimaryColorCode } = useTheme();
  const [loaderColor, setLoaderColor] = useState<string>(
    getPrimaryColorCode()
  );
  const containerMinHeight = height || "100%";

  useEffect(() => {
    const cachedBranding = getCachedInstituteBranding();
    if (cachedBranding?.instituteThemeCode) {
      setLoaderColor(cachedBranding.instituteThemeCode);
    } else {
      setLoaderColor(getPrimaryColorCode());
    }
  }, [getPrimaryColorCode]);

  return (
    <ErrorBoundary>
      <div
        className={`${
          fullscreen ? "fixed inset-0" : "w-full"
        } flex items-center justify-center bg-background`}
        style={{ minHeight: containerMinHeight }}
      >
        <div className="flex flex-col items-center justify-center gap-4 px-4">
          <Logo className="size-16 object-contain sm:size-12 md:size-14" />

          <div className="w-32 sm:w-40 md:w-48">
            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  background: loaderColor,
                  animation: "loading-progress 2s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        </div>
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
    </ErrorBoundary>
  );
};

