import { create } from "zustand";

interface InstituteStore {
    instituteLogo: string;
    setInstituteLogo: (logo: string) => void;
    resetInstituteLogo: () => void;
}

const useInstituteLogoStore = create<InstituteStore>((set) => ({
    instituteLogo: "",
    setInstituteLogo: (logo) => set({ instituteLogo: logo }),
    resetInstituteLogo: () => set({ instituteLogo: "" }), // Reset function
}));

export default useInstituteLogoStore;
