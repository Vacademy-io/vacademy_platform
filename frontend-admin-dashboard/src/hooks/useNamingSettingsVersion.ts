import { useEffect, useState } from 'react';
import i18next from 'i18next';

export const NAMING_SETTINGS_UPDATED_EVENT = 'naming-settings-updated';

// Components call this hook to re-render when naming settings change.
// The returned version is bumped whenever NamingSettings page saves, when
// localStorage is updated from another tab, or when the UI language changes —
// terminology is locale-aware (see resolveLocalizedTerm in
// components/common/layout-container/sidebar/utils.ts), so a language switch
// changes the same labels a rename does.
export const useNamingSettingsVersion = (): number => {
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const bump = () => setVersion((v) => v + 1);
        window.addEventListener(NAMING_SETTINGS_UPDATED_EVENT, bump);
        window.addEventListener('storage', bump);
        i18next.on('languageChanged', bump);
        return () => {
            window.removeEventListener(NAMING_SETTINGS_UPDATED_EVENT, bump);
            window.removeEventListener('storage', bump);
            i18next.off('languageChanged', bump);
        };
    }, []);

    return version;
};

export const notifyNamingSettingsUpdated = (): void => {
    window.dispatchEvent(new Event(NAMING_SETTINGS_UPDATED_EVENT));
};
