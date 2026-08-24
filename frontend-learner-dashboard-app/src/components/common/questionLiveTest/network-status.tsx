import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";
import { WifiHigh, WifiSlash, ArrowsClockwise, SpinnerGap } from "@phosphor-icons/react";
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
    // In the normal flow, not floating: as an overlay this sat on top of the
    // exam header and hid the timer and Submit button on a phone — exactly when
    // a learner most needs to see them. It is a persistent state, so pushing
    // the content down is the right trade.
    <div
      className="flex flex-none items-center justify-center gap-3 bg-neutral-900 px-3 py-2 text-white"
      role="status"
      aria-live="polite"
    >
      {!isOnline ? (
        <>
          <WifiSlash className="size-5 flex-none text-danger-400" />
          <div className="min-w-0">
            <p className="text-caption font-semibold">No internet connection</p>
            <p className="text-2xs text-neutral-400">
              Your answers are held on this device and re-sent when you are back
              online.
            </p>
          </div>
        </>
      ) : saveFailed ? (
        <>
          <WifiSlash className="size-5 flex-none text-warning-400" />
          <div className="min-w-0">
            <p className="text-caption font-semibold">Answers not syncing</p>
            <p className="text-2xs text-neutral-400">
              They are safe on this device. Tap retry to sync now.
            </p>
          </div>
        </>
      ) : (
        <>
          <WifiHigh className="size-5 flex-none text-success-400" />
          <div className="min-w-0">
            <p className="text-caption font-semibold">Back online</p>
            <p className="text-2xs text-neutral-400">
              Your network connection was restored.
            </p>
          </div>
        </>
      )}
      {(saveFailed || !isOnline) && onRetrySave && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={isRetrying}
          className="flex flex-none items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-2xs font-semibold transition-colors hover:bg-white/20 disabled:opacity-60"
        >
          {isRetrying ? (
            <SpinnerGap className="size-3 animate-spin" />
          ) : (
            <ArrowsClockwise className="size-3" />
          )}
          Retry
        </button>
      )}
    </div>
  );
};

export default NetworkStatus;
