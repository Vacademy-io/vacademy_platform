import { GearSix } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { useQuickSettingsStore } from '@/stores/settings/useQuickSettingsStore';

interface SettingsQuickAccessButtonProps {
    /** SettingsTabs key of the setting to pop open (e.g. SettingsTabs.LiveSession). */
    settingsKey: string;
    /** Shown in the title/aria-label tooltip — the setting's display name. */
    label?: string;
    className?: string;
}

/**
 * Drop this anywhere in the app to open a settings screen in a popup instead
 * of navigating to /settings. Deliberately does not import the settings
 * registry — it only needs the key, so it stays cheap at every call site.
 */
export function SettingsQuickAccessButton({
    settingsKey,
    label = 'Settings',
    className,
}: SettingsQuickAccessButtonProps) {
    const openQuickSettings = useQuickSettingsStore((s) => s.openQuickSettings);

    return (
        <MyButton
            type="button"
            buttonType="secondary"
            scale="small"
            layoutVariant="icon"
            className={className}
            title={label}
            aria-label={label}
            onClick={() => openQuickSettings(settingsKey)}
        >
            <GearSix size={16} weight="regular" />
        </MyButton>
    );
}
