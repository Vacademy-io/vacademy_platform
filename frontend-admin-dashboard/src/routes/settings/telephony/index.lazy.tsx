import { createLazyFileRoute } from '@tanstack/react-router';
import { TelephonySettingsPage } from './-components/telephony-settings-page';

// Cast until the TanStack Router code generator regenerates routeTree.gen.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createLazyFileRoute('/settings/telephony/' as any)({
    component: TelephonySettingsPage,
});
