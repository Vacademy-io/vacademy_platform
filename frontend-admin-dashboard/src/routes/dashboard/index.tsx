import { createFileRoute, redirect } from '@tanstack/react-router';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import {
    getDisplaySettingsFromCache,
    resolveEffectivePostLoginRoute,
} from '@/services/display-settings';

// Route definition only - component is lazy loaded from index.lazy.tsx
// This reduces initial bundle size by deferring the Dashboard component loading
export const Route = createFileRoute('/dashboard/')({
    // /dashboard is the universal home page. Its widgets are per-role gated
    // (e.g. a sub-org admin only sees their own sub-org stats), so landing here
    // is always role-appropriate — hiding the CRM *section* must NOT make the
    // dashboard unreachable (that's what blocked sub-org admins, whose custom
    // role hides CRM but who still need their dashboard).
    //
    // Only redirect away when the Dashboard TAB itself is explicitly hidden for
    // this role. In that case route the user to their effective landing page.
    beforeLoad: () => {
        const roleKey = getActiveRoleDisplaySettingsKey();
        const ds = getDisplaySettingsFromCache(roleKey);
        if (!ds) return;
        const dashboardTab = ds.sidebar?.find((t) => t.id === 'dashboard');
        if (dashboardTab?.visible !== false) return; // tab visible (or absent) → reachable
        const target = resolveEffectivePostLoginRoute('/dashboard', ds);
        if (target && target !== '/dashboard') {
            throw redirect({ to: target, replace: true });
        }
    },
});
