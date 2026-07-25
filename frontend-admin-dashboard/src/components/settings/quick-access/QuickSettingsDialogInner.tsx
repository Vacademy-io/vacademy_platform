import { MyDialog } from '@/components/design-system/dialog';
import { useQuickSettingsStore } from '@/stores/settings/useQuickSettingsStore';
import { getSettingsEntryByKey } from '@/routes/settings/-utils/utils';

/**
 * The actual quick-access popup content. Lazy-loaded by QuickSettingsDialog
 * (which is mounted globally) so the full settings-component registry only
 * ever gets pulled into the bundle on first real use, not on every route.
 */
export default function QuickSettingsDialogInner() {
    const openKey = useQuickSettingsStore((s) => s.openKey);
    const closeQuickSettings = useQuickSettingsStore((s) => s.closeQuickSettings);

    const entry = openKey ? getSettingsEntryByKey(openKey) : undefined;
    // Unknown/stale key (e.g. a bookmarked ?quickSettings= for a setting that
    // no longer exists) — close rather than render nothing inside an open shell.
    if (openKey && !entry) {
        closeQuickSettings();
        return null;
    }

    const EntryComponent = entry?.embeddedComponent ?? entry?.component;

    return (
        <MyDialog
            open={!!openKey}
            onOpenChange={(open) => {
                if (!open) closeQuickSettings();
            }}
            heading={entry?.value ?? ''}
            dialogWidth="max-w-3xl"
        >
            {EntryComponent && <EntryComponent embedded />}
        </MyDialog>
    );
}
