import useLocalStorage from './use-local-storage';
import { StorageKey } from '@/constants/storage/storage';
import { NamingSettingsType } from '@/routes/settings/-constants/terms';

export const useNamingSettings = () => {
    const { getValue } = useLocalStorage<NamingSettingsType[]>(
        StorageKey.NAMING_SETTINGS,
        []
    );

    const getTerminology = (key: string, defaultValue: string): string => {
        const settings = getValue();
        const setting = settings.find((s: NamingSettingsType) => s.key === key);
        return setting?.customValue || defaultValue;
    };

    return {
        getTerminology,
        settings: getValue(),
    };
};
