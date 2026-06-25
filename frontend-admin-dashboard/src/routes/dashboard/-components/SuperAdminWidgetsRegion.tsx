import { useQuery } from '@tanstack/react-query';
import { getMyWidgetsQuery } from '@/services/institute-widgets';
import OnboardingTrackerWidget from './OnboardingTrackerWidget';
import InfoCardWidget from './InfoCardWidget';

/**
 * Renders super-admin-managed widgets (onboarding trackers + info cards) for the current institute
 * and role, fetched from community-service. Purely additive: returns null when there are none, so an
 * institute with no configured widgets sees an unchanged dashboard.
 */
export default function SuperAdminWidgetsRegion() {
    const { data } = useQuery(getMyWidgetsQuery());
    const widgets = data ?? [];

    if (widgets.length === 0) {
        return null;
    }

    return (
        <div className="flex w-full flex-col gap-4">
            {widgets.map((widget) =>
                widget.widgetType === 'ONBOARDING_TRACKER' ? (
                    <OnboardingTrackerWidget key={widget.id} widget={widget} />
                ) : (
                    <InfoCardWidget key={widget.id} widget={widget} />
                )
            )}
        </div>
    );
}
