import { useOtaUpdate } from "@/stores/useOtaUpdate";
import { downloadAndApplyUpdate } from "@/services/ota-update";

export function OtaUpdateBanner() {
  const {
    otaUpdateAvailable,
    otaVersion,
    otaDownloadUrl,
    otaChecksum,
    otaForceUpdate,
    otaReleaseNotes,
    otaDownloading,
    setOtaDownloading,
    resetOta,
  } = useOtaUpdate();

  if (!otaUpdateAvailable) return null;

  const handleUpdate = async () => {
    if (!otaDownloadUrl || !otaVersion || !otaChecksum) return;
    try {
      setOtaDownloading(true);
      await downloadAndApplyUpdate(otaDownloadUrl, otaVersion, otaChecksum);
      // Bundle is staged — it will load on next app restart.
      // The set() call in the service already triggers a reload.
    } catch (e) {
      console.error("OTA download failed:", e);
      setOtaDownloading(false);
    }
  };

  // Force update: full-screen blocking overlay
  if (otaForceUpdate) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="mx-4 max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            Update Required
          </h2>
          <p className="mb-1 text-sm text-gray-500">Version {otaVersion}</p>
          {otaReleaseNotes && (
            <p className="mb-4 text-sm text-gray-600">{otaReleaseNotes}</p>
          )}
          {otaDownloading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-gray-500">Downloading update...</p>
            </div>
          ) : (
            <button
              onClick={handleUpdate}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Update Now
            </button>
          )}
        </div>
      </div>
    );
  }

  // Optional update: dismissible top banner
  return (
    <div className="fixed left-0 right-0 top-0 z-[9998] flex items-center justify-between bg-primary/90 px-4 py-2 text-white backdrop-blur-sm">
      <span className="text-sm">
        Update {otaVersion} available
        {otaReleaseNotes ? ` — ${otaReleaseNotes}` : ""}
      </span>
      <div className="flex items-center gap-2">
        {otaDownloading ? (
          <span className="text-xs">Downloading...</span>
        ) : (
          <button
            onClick={handleUpdate}
            className="rounded bg-white/20 px-3 py-1 text-xs font-medium hover:bg-white/30"
          >
            Update
          </button>
        )}
        <button
          onClick={resetOta}
          className="rounded px-2 py-1 text-xs hover:bg-white/20"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
