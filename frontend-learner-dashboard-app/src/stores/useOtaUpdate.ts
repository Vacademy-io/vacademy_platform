import { create } from "zustand";

interface OtaUpdateState {
  otaUpdateAvailable: boolean;
  otaVersion: string | null;
  otaDownloadUrl: string | null;
  otaChecksum: string | null;
  otaForceUpdate: boolean;
  otaReleaseNotes: string | null;
  otaDownloading: boolean;

  setOtaUpdate: (update: {
    otaUpdateAvailable: boolean;
    otaVersion?: string | null;
    otaDownloadUrl?: string | null;
    otaChecksum?: string | null;
    otaForceUpdate?: boolean;
    otaReleaseNotes?: string | null;
  }) => void;
  setOtaDownloading: (downloading: boolean) => void;
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

  setOtaUpdate: (update) => set({ ...update }),
  setOtaDownloading: (downloading) => set({ otaDownloading: downloading }),
  resetOta: () =>
    set({
      otaUpdateAvailable: false,
      otaVersion: null,
      otaDownloadUrl: null,
      otaChecksum: null,
      otaForceUpdate: false,
      otaReleaseNotes: null,
      otaDownloading: false,
    }),
}));
