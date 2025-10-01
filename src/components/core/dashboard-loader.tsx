import { useTheme } from "@/providers/theme/theme-provider";
import ClipLoader from "react-spinners/ClipLoader";
import { useState, useEffect } from "react";

const learningMessages = [
  "Loading...",
  "Setting up...",
  "Almost ready..."
];

// Shimmer Card Component
const ShimmerCard = ({ className = "", children }: { className?: string; children?: React.ReactNode }) => (
  <div className={`bg-white border border-slate-200 rounded-lg p-4 ${className}`}>
    <div className="shimmer-wrapper">
      {children}
    </div>
  </div>
);

// Shimmer Bar Component
const ShimmerBar = ({ width = "100%", height = "h-4", className = "" }: { width?: string; height?: string; className?: string }) => (
  <div className={`${height} bg-slate-200 rounded shimmer ${className}`} style={{ width }} />
);

export function DashboardLoader() {
  const { getPrimaryColorCode } = useTheme();
  const [messageIndex, setMessageIndex] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % learningMessages.length);
    }, 2000);

    const dotsInterval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return "";
        return prev + ".";
      });
    }, 400);

    return () => {
      clearInterval(messageInterval);
      clearInterval(dotsInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-50 overflow-auto">
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Main Content Area with Shimmer Cards */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto">
            {/* Header Section */}
            <div className="mb-8">
              <ShimmerCard className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <ShimmerBar width="200px" height="h-6" />
                    <ShimmerBar width="300px" height="h-4" />
                  </div>
                  <div className="flex gap-2">
                    <ShimmerBar width="80px" height="h-8" />
                    <ShimmerBar width="100px" height="h-8" />
                  </div>
                </div>
              </ShimmerCard>
            </div>

            {/* Stats Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <ShimmerCard key={i}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <ShimmerBar width="60px" height="h-4" />
                      <ShimmerBar width="24px" height="h-6" className="rounded-full" />
                    </div>
                    <ShimmerBar width="80px" height="h-8" />
                    <ShimmerBar width="120px" height="h-3" />
                  </div>
                </ShimmerCard>
              ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Left Column - Large Card */}
              <div className="lg:col-span-2">
                <ShimmerCard className="h-80">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <ShimmerBar width="150px" height="h-5" />
                      <ShimmerBar width="60px" height="h-4" />
                    </div>
                    <div className="space-y-3">
                      <ShimmerBar width="100%" height="h-32" />
                      <div className="flex gap-4">
                        <ShimmerBar width="80px" height="h-4" />
                        <ShimmerBar width="100px" height="h-4" />
                        <ShimmerBar width="60px" height="h-4" />
                      </div>
                    </div>
                  </div>
                </ShimmerCard>
              </div>

              {/* Right Column - Smaller Cards */}
              <div className="space-y-4">
                <ShimmerCard className="h-36">
                  <div className="space-y-3">
                    <ShimmerBar width="120px" height="h-4" />
                    <ShimmerBar width="100%" height="h-16" />
                    <ShimmerBar width="80px" height="h-3" />
                  </div>
                </ShimmerCard>
                <ShimmerCard className="h-36">
                  <div className="space-y-3">
                    <ShimmerBar width="100px" height="h-4" />
                    <ShimmerBar width="100%" height="h-16" />
                    <ShimmerBar width="90px" height="h-3" />
                  </div>
                </ShimmerCard>
              </div>
            </div>

            {/* List Items */}
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <ShimmerCard key={i}>
                  <div className="flex items-center gap-4">
                    <ShimmerBar width="48px" height="h-12" className="rounded-full" />
                    <div className="flex-1 space-y-2">
                      <ShimmerBar width="200px" height="h-4" />
                      <ShimmerBar width="300px" height="h-3" />
                    </div>
                    <ShimmerBar width="80px" height="h-8" />
                  </div>
                </ShimmerCard>
              ))}
            </div>
          </div>
        </div>

        {/* Loading Status Panel */}
        <div className="lg:w-80 bg-white border-l border-slate-200 p-6">
          <div className="sticky top-6">
            {/* Logo/Icon Section */}
            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <svg className="w-8 h-8 text-slate-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>

            {/* Loading Spinner */}
            <div className="text-center mb-6">
              <ClipLoader 
                size={32} 
                color={getPrimaryColorCode()} 
                speedMultiplier={0.8}
              />
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-1.5 bg-slate-600 rounded-full transition-all duration-300 ease-out" 
                  style={{ 
                    width: '65%',
                    animation: 'loadingProgress 2.5s ease-in-out infinite'
                  }}
                />
              </div>
            </div>

            {/* Dynamic Message */}
            <div className="text-center space-y-3 mb-8">
              <p className="text-sm font-medium text-slate-800 transition-opacity duration-500">
                {learningMessages[messageIndex]}{dots}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                We're setting up everything for your best learning experience
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes loadingProgress {
            0% { width: 20%; }
            50% { width: 75%; }
            100% { width: 20%; }
          }
          
          @keyframes shimmer {
            0% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
            100% {
              opacity: 1;
            }
          }
          
          .shimmer {
            background: #e2e8f0;
            animation: shimmer 1.5s linear infinite;
          }
          
          .shimmer-wrapper {
            position: relative;
            overflow: hidden;
          }
        `
      }} />
    </div>
  );
}