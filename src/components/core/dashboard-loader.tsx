import { useTheme } from "@/providers/theme/theme-provider";
import ClipLoader from "react-spinners/ClipLoader";
import { useState, useEffect } from "react";

const learningMessages = [
  "Preparing your learning materials...",
  "Setting up your study environment...",
  "Loading your progress...",
  "Getting your lessons ready...",
  "Organizing your curriculum...",
  "Syncing your achievements...",
  "Preparing personalized content...",
  "Loading educational resources..."
];

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
    <div className="flex h-screen flex-col items-center justify-center bg-gradient-to-br from-white via-primary-50/20 to-blue-50/30 p-8">
      {/* Main Loading Container */}
      <div className="flex flex-col items-center justify-center max-w-md w-full">
        {/* Logo/Icon Section */}
        <div className="relative mb-8 group">
          <div className="absolute -inset-4 bg-gradient-to-r from-primary-400/30 to-blue-500/30 rounded-full blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-700 animate-pulse"></div>
          <div className="relative p-6 bg-gradient-to-br from-white to-primary-50 border border-primary-200 rounded-2xl">
            <div className="relative">
              <svg className="w-12 h-12 text-primary-600 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              
              {/* Floating Particles */}
              <div className="absolute -top-2 -right-2 w-3 h-3 bg-primary-400 rounded-full animate-ping opacity-75"></div>
              <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full animate-ping opacity-60" style={{ animationDelay: '0.5s' }}></div>
              <div className="absolute top-0 left-8 w-1.5 h-1.5 bg-primary-300 rounded-full animate-ping opacity-50" style={{ animationDelay: '1s' }}></div>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-blue-500 rounded-full blur-sm opacity-30 animate-pulse"></div>
          <ClipLoader 
            size={50} 
            color={getPrimaryColorCode()} 
            speedMultiplier={0.8}
            cssOverride={{
              display: "block",
              position: "relative",
              zIndex: 10
            }}
          />
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-xs mb-6">
          <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary-500 to-blue-500 rounded-full animate-pulse" 
                 style={{ 
                   width: '70%',
                   animation: 'loadingProgress 3s ease-in-out infinite'
                 }}>
            </div>
          </div>
        </div>

        {/* Dynamic Message */}
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-neutral-800 animate-in fade-in duration-700">
            {learningMessages[messageIndex]}{dots}
          </p>
          <p className="text-sm text-neutral-500 max-w-sm">
            We're setting up everything for your best learning experience
          </p>
        </div>

        {/* Learning Tips */}
        <div className="mt-8 p-4 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-lg max-w-sm">
          <div className="flex items-start gap-3">
            <div className="p-1 bg-primary-100 rounded-full flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-primary-800 mb-1">Learning Tip</p>
              <p className="text-xs text-primary-700 leading-relaxed">
                Set aside dedicated time for studying to build consistent learning habits!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes loadingProgress {
            0%, 100% { width: 20%; }
            50% { width: 80%; }
          }
          
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
        `
      }} />
    </div>
  );
}
