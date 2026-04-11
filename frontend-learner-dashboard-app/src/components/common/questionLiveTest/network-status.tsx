import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";
import { Wifi, WifiOff, RefreshCw, Loader2 } from "lucide-react";
import type { PluginListenerHandle } from "@capacitor/core";
import { useAssessmentStore } from "@/stores/assessment-store";

interface NetworkStatusProps {
  onRetrySave?: () => Promise<unknown>;
}

const NetworkStatus = ({ onRetrySave }: NetworkStatusProps) => {
  const [isOnline, setIsOnline] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const remoteSaveStatus = useAssessmentStore((s) => s.remoteSaveStatus);

  useEffect(() => {
    const checkNetworkStatus = async () => {
      const status = await Network.getStatus();
      setIsOnline(status.connected);
      setShowAlert(!status.connected);
    };

    checkNetworkStatus();

    let listener: PluginListenerHandle | null = null;

    const setupListener = async () => {
      listener = await Network.addListener("networkStatusChange", (status) => {
        setIsOnline(status.connected);
        setShowAlert(true);

        // Auto-hide the online notification after 2 seconds
        if (status.connected) {
          setTimeout(() => setShowAlert(false), 2000);
        }
      });
    };

    setupListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, []);

  const saveFailed = remoteSaveStatus === "failed";
  const showBanner = showAlert || saveFailed;

  if (!showBanner) return null;

  const handleRetry = async () => {
    if (!onRetrySave || isRetrying) return;
    setIsRetrying(true);
    try {
      await onRetrySave();
    } catch {
      // Error already handled downstream; banner will stay visible.
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-start justify-center">
      <div
        className={`
          mt-4 flex items-center gap-3 rounded-lg px-4 py-2
          transform transition-all duration-300 ease-in-out
          bg-[#0f0f0f] text-white
          ${showBanner ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}
        `}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          {!isOnline ? (
            <>
              <WifiOff className="h-5 w-5 text-red-500" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">No Internet connection</span>
                <span className="text-xs text-gray-400">
                  Your responses will be saved when connection returns
                </span>
              </div>
            </>
          ) : saveFailed ? (
            <>
              <WifiOff className="h-5 w-5 text-amber-500" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Save failed</span>
                <span className="text-xs text-gray-400">
                  Your responses could not be synced
                </span>
              </div>
            </>
          ) : (
            <>
              <Wifi className="h-5 w-5 text-green-500" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Back online</span>
                <span className="text-xs text-gray-400">
                  Your network connection was restored
                </span>
              </div>
            </>
          )}
          {(saveFailed || !isOnline) && onRetrySave && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="ml-2 flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs font-medium hover:bg-white/20 disabled:opacity-60"
            >
              {isRetrying ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkStatus;
