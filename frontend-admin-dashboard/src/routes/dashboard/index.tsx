import { createFileRoute, redirect } from '@tanstack/react-router';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import {
    getDisplaySettingsFromCache,
    resolveEffectivePostLoginRoute,
} from '@/services/display-settings';

// Route definition only - component is lazy loaded from index.lazy.tsx
// This reduces initial bundle size by deferring the Dashboard component loading
export const Route = createFileRoute('/dashboard/')({
    // /dashboard belongs to the CRM category. If the role hides CRM, route the
    // user to their effective landing page so they don't see CRM widgets while
    // the sidebar shows LMS/AI as the active section.
    beforeLoad: () => {
        const roleKey = getActiveRoleDisplaySettingsKey();
        const ds = getDisplaySettingsFromCache(roleKey);
        if (!ds) return;
        const target = resolveEffectivePostLoginRoute('/dashboard', ds);
        if (target && target !== '/dashboard') {
            throw redirect({ to: target, replace: true });
        }
    },
});
