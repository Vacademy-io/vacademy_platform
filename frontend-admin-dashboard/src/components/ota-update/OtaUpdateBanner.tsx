import { CircleNotch } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import { useOtaUpdate } from '@/stores/useOtaUpdate';
import { downloadAndApplyUpdate } from '@/services/ota-update';

// In-app OTA prompt for self-hosted-OTA flavors (e.g. Vacademy Admin). The
// store is only populated by initSelfHostedOTA() on native, so this renders
// nothing on web and on Capgo-OTA flavors.
//   - force_update => full-screen blocking overlay (no dismiss).
//   - optional     => dismissible top banner.
export function OtaUpdateBanner() {
    const {
        otaUpdateAvailable,
        otaVersion,
        otaDownloadUrl,
        otaChecksum,
        otaForceUpdate,
        otaReleaseNotes,
        otaDownloading,
        otaAutoUpdating,
        setOtaDownloading,
        resetOta,
    } = useOtaUpdate();

    // Auto-updating dialog ("auto" mode): non-dismissible loader shown at launch
    // while the new bundle downloads + applies in place. No user action needed.
    if (otaAutoUpdating) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm pt-safe pb-safe">
                <div className="flex w-full max-w-sm flex-col items-center rounded-lg bg-white p-6 text-center shadow-lg">
                    <CircleNotch className="mb-4 size-10 animate-spin text-primary-500" />
                    <h2 className="mb-1 text-subtitle font-semibold text-neutral-700">
                        Updating app…
                    </h2>
                    {otaVersion && (
                        <p className="mb-1 text-caption text-neutral-500">
                            Version {otaVersion}
                        </p>
                    )}
                    <p className="text-body text-neutral-600">Please wait a moment</p>
                </div>
            </div>
        );
    }

    if (!otaUpdateAvailable) return null;

    const handleUpdate = async () => {
        if (!otaDownloadUrl || !otaVersion || !otaChecksum) return;
        try {
            setOtaDownloading(true);
            // set() inside this reloads the WebView once the bundle is staged.
            await downloadAndApplyUpdate(otaDownloadUrl, otaVersion, otaChecksum);
        } catch {
            setOtaDownloading(false);
        }
    };

    // Force update: full-screen blocking overlay.
    if (otaForceUpdate) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm pt-safe pb-safe">
                <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-lg">
                    <h2 className="mb-1 text-subtitle font-semibold text-neutral-700">
                        Update required
                    </h2>
                    {otaVersion && (
                        <p className="mb-2 text-caption text-neutral-500">Version {otaVersion}</p>
                    )}
                    {otaReleaseNotes && (
                        <p className="mb-4 text-body text-neutral-600">{otaReleaseNotes}</p>
                    )}
                    {otaDownloading ? (
                        <div className="flex flex-col items-center gap-2">
                            <CircleNotch className="size-8 animate-spin text-primary-500" />
                            <p className="text-caption text-neutral-500">Downloading update…</p>
                        </div>
                    ) : (
                        <MyButton
                            buttonType="primary"
                            scale="large"
                            className="w-full"
                            onClick={handleUpdate}
                        >
                            Update now
                        </MyButton>
                    )}
                </div>
            </div>
        );
    }

    // Optional update: dismissible top banner (sits below the status bar/notch).
    return (
        <div
            className={cn(
                'fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3',
                'bg-primary-500 px-4 py-2 text-neutral-50 pt-safe'
            )}
        >
            <span className="text-caption">
                Update {otaVersion} available
                {otaReleaseNotes ? ` — ${otaReleaseNotes}` : ''}
            </span>
            <div className="flex shrink-0 items-center gap-2">
                {otaDownloading ? (
                    <span className="text-caption">Downloading…</span>
                ) : (
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        className="border-neutral-50 bg-transparent !text-neutral-50"
                        onClick={handleUpdate}
                    >
                        Update
                    </MyButton>
                )}
                <MyButton
                    buttonType="text"
                    scale="small"
                    className="!text-neutral-50"
                    onClick={resetOta}
                >
                    Dismiss
                </MyButton>
            </div>
        </div>
    );
}
