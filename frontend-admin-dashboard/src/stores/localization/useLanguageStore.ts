import { create } from "zustand";

interface LanguageState {
    language: string;
    setLanguage: (language: string) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
    language: "English", // default language
    setLanguage: (language) => set({ language }),
}));
