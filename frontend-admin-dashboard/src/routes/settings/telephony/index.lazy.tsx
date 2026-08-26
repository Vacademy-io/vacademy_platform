import { createLazyFileRoute } from '@tanstack/react-router';
import { TelephonySettingsPage } from './-components/telephony-settings-page';

export const Route = createLazyFileRoute('/settings/telephony/')({
    component: TelephonySettingsPage,
});
