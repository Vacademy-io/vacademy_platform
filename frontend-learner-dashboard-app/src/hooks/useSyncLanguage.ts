import { useEffect } from "react";
import i18n from "@/i18n";
import { useLanguageStore } from "@/stores/localization/useLanguageStore";

export const useSyncLanguage = () => {
    const { language } = useLanguageStore();

    useEffect(() => {
        i18n.changeLanguage(language);
    }, [language]);
};
