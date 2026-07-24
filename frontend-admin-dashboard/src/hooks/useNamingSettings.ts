import useLocalStorage from './use-local-storage';
import { StorageKey } from '@/constants/storage/storage';
import { NamingSettingsType } from '@/routes/settings/-constants/terms';
import { resolveLocalizedTerm } from '@/components/common/layout-container/sidebar/utils';

export const useNamingSettings = () => {
    const { getValue } = useLocalStorage<NamingSettingsType[]>(StorageKey.NAMING_SETTINGS, []);

    // Both resolvers run the same locale chain as the standalone
    // getTerminology/getTerminologyPlural in sidebar/utils.ts — per-locale
    // override → translated system default → this hook's own original fallback,
    // which is left exactly as it was (see resolveLocalizedTerm; it returns null
    // for an English UI, so nothing below changes for English).
    const getTerminology = (key: string, defaultValue: string): string => {
        const settings = getValue();
        const setting = settings.find((s: NamingSettingsType) => s.key === key);
        // `||`, not `??` — an empty customValue must still fall through to
        // defaultValue exactly as before. resolveLocalizedTerm only ever
        // returns null or a non-empty string.
        return (
            resolveLocalizedTerm(setting, key, 'singular') || setting?.customValue || defaultValue
        );
    };

    const getTerminologyPlural = (key: string, defaultValue: string): string => {
        const settings = getValue();
        const setting = settings.find((s: NamingSettingsType) => s.key === key);
        return (
            resolveLocalizedTerm(setting, key, 'plural') ||
            setting?.customPluralValue ||
            defaultValue
        );
    };

    return {
        getTerminology,
        getTerminologyPlural,
        settings: getValue(),
    };
};
