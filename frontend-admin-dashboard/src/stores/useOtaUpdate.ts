import { create } from 'zustand';

interface OtaUpdateState {
    otaUpdateAvailable: boolean;
    otaVersion: string | null;
    otaDownloadUrl: string | null;
    otaChecksum: string | null;
    otaForceUpdate: boolean;
    otaReleaseNotes: string | null;
    otaDownloading: boolean;
    // True while the auto-updating dialog is downloading + applying a bundle in
    // place (the "auto" OTA mode). Drives the non-dismissible loader dialog.
    otaAutoUpdating: boolean;

    setOtaUpdate: (update: {
        otaUpdateAvailable: boolean;
        otaVersion?: string | null;
        otaDownloadUrl?: string | null;
        otaChecksum?: string | null;
        otaForceUpdate?: boolean;
        otaReleaseNotes?: string | null;
    }) => void;
    setOtaDownloading: (downloading: boolean) => void;
    setOtaAutoUpdating: (updating: boolean, version?: string | null) => void;
    resetOta: () => void;
}

export const useOtaUpdate = create<OtaUpdateState>((set) => ({
    otaUpdateAvailable: false,
    otaVersion: null,
    otaDownloadUrl: null,
    otaChecksum: null,
    otaForceUpdate: false,
    otaReleaseNotes: null,
    otaDownloading: false,
    otaAutoUpdating: false,

    setOtaUpdate: (update) => set({ ...update }),
    setOtaDownloading: (downloading) => set({ otaDownloading: downloading }),
    setOtaAutoUpdating: (updating, version) =>
        set(
            version !== undefined
                ? { otaAutoUpdating: updating, otaVersion: version }
                : { otaAutoUpdating: updating }
        ),
    resetOta: () =>
        set({
            otaUpdateAvailable: false,
            otaVersion: null,
            otaDownloadUrl: null,
            otaChecksum: null,
            otaForceUpdate: false,
            otaReleaseNotes: null,
            otaDownloading: false,
            otaAutoUpdating: false,
        }),
}));
