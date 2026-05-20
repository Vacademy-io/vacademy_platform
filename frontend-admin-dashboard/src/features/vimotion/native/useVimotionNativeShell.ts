import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { hideSplash } from '@/native';
import { setDeepLinkListener } from '@/native/deepLinks';

// Mounts in the vim screens (LoginForm, OnboardingWizard, DashboardLayout,
// editor mobile gate). Two jobs:
//   1. Hide the native splash on first paint. `hideSplash` is module-level
//      idempotent so calling it from multiple screens is safe.
//   2. Subscribe to deep-link payloads. The producer (src/native/deepLinks.ts)
//      buffers anything that arrives while no listener is registered, so even
//      a cold-start URL that fires before React mounts will be delivered to
//      the first screen that subscribes.
//
// Only ONE active listener is supported at a time. When a vim screen unmounts,
// the next one takes over via its own `setDeepLinkListener` call on mount; any
// payload arriving in the transition window queues and drains immediately on
// the new subscription.
export function useVimotionNativeShell(): void {
    const navigate = useNavigate();

    useEffect(() => {
        void hideSplash();
    }, []);

    useEffect(() => {
        // TanStack Router's `to` is typed as a literal union of route ids; deep
        // links carry opaque strings (already URL-encoded by the producer). We
        // cast through `as never` because the runtime accepts free-form paths
        // and there's no typed router-helper for arbitrary URLs.
        setDeepLinkListener((payload) => {
            navigate({ to: payload.path as never, replace: payload.replace ?? false });
        });
        return () => setDeepLinkListener(null);
    }, [navigate]);
}
