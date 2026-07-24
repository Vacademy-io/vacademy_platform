import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { getDisplaySettingsFromCache } from '@/services/display-settings';
import { ADMIN_DISPLAY_SETTINGS_KEY } from '@/types/display-settings';
import { useAssistDock } from './store';

/**
 * Resolve whether the Assist Dock rail is visible for the active role from the
 * cached display settings (ui.showAssistDock). Admin defaults to visible;
 * teacher/custom roles are hidden unless opted in from that role's Display
 * Settings → UI Options.
 */
export function resolveAssistDockVisibleFromCache(): boolean {
    const roleKey = getActiveRoleDisplaySettingsKey();
    const ds = getDisplaySettingsFromCache(roleKey);
    return ds?.ui?.showAssistDock ?? roleKey === ADMIN_DISPLAY_SETTINGS_KEY;
}

/**
 * Reactive dock visibility for components that reserve space for the rail
 * (LayoutContainer's right gutter, student side-view right padding). Prefers
 * the value AssistDock itself resolved (kept in the dock store, so it updates
 * the moment settings finish loading or change); falls back to the cache so
 * first paint matches the rail's own first paint.
 */
export function useAssistDockVisible(): boolean {
    const resolved = useAssistDock((s) => s.dockVisible);
    return resolved ?? resolveAssistDockVisibleFromCache();
}
