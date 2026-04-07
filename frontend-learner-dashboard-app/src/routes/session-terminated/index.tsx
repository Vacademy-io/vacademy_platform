import { createFileRoute, Link } from "@tanstack/react-router";
import { Monitor, LogIn, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/session-terminated/")({
  component: SessionTerminatedPage,
});

function SessionTerminatedPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header banner */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-400 px-8 py-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3">
              <ShieldAlert className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-white">
              Session Terminated
            </h1>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            <div className="text-center space-y-4">
              <p className="text-gray-700 text-base leading-relaxed">
                Your session was ended because your account was accessed from
                another device. For security, only a limited number of
                simultaneous sessions are allowed.
              </p>

              {/* Device illustration */}
              <div className="flex items-center justify-center gap-4 py-4">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <Monitor className="w-6 h-6 text-red-500" />
                  </div>
                  <span className="text-xs text-gray-400">This device</span>
                </div>

                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-300 animate-pulse" />
                  <div className="w-8 h-px bg-red-200" />
                  <span className="text-red-400 text-sm font-medium">
                    disconnected
                  </span>
                  <div className="w-8 h-px bg-red-200" />
                  <div className="w-2 h-2 rounded-full bg-red-300 animate-pulse" />
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Monitor className="w-6 h-6 text-green-500" />
                  </div>
                  <span className="text-xs text-gray-400">New device</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                If this wasn't you, please log in and change your password
                immediately.
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 space-y-3">
              <Link
                to="/login"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-400 text-white font-medium rounded-xl hover:from-primary-500/90 hover:to-primary-400/90 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <LogIn className="w-5 h-5" />
                Log In Again
              </Link>

              <p className="text-center text-xs text-gray-400 pt-2">
                You will need to enter your credentials to start a new session
              </p>
            </div>
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Having trouble?{" "}
          <span className="text-gray-500">
            Contact your institute administrator for help.
          </span>
        </p>
      </div>
    </div>
  );
}
