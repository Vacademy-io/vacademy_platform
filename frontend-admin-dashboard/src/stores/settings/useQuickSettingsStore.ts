// stores/settings/useQuickSettingsStore.ts
import { create } from 'zustand';

interface QuickSettingsStore {
    /** SettingsTabs key of the settings screen currently popped open, or null. */
    openKey: string | null;
    openQuickSettings: (key: string) => void;
    closeQuickSettings: () => void;
}

export const useQuickSettingsStore = create<QuickSettingsStore>((set) => ({
    openKey: null,
    openQuickSettings: (key) => set({ openKey: key }),
    closeQuickSettings: () => set({ openKey: null }),
}));
