import { AppUpdate, AppUpdateAvailability } from "@capawesome/capacitor-app-update";
import { create } from "zustand";

interface State {
    updateAvailable: boolean;
    setUpdateAvailable: (updateAvailable: boolean) => void;
    performImmediateUpdate: () => void;
}

export const useUpdate = create<State>((set) => ({
    updateAvailable: false,
    setUpdateAvailable: (updateAvailable) => set({ updateAvailable }),
    performImmediateUpdate: async () => {
        const result = await AppUpdate.getAppUpdateInfo();
        if (result.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
            return;
        }
        if (result.immediateUpdateAllowed) {
            await AppUpdate.performImmediateUpdate();
        }
    },
}));