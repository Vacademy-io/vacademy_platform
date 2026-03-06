package vacademy.io.admin_core_service.features.live_session.provider;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.live_session.provider.manager.ZohoMeetingManager;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.meeting.enums.MeetingProvider;

import java.util.Map;

/**
 * Factory that resolves the correct LiveSessionProviderStrategy by
 * MeetingProvider enum.
 * To add a new provider: implement LiveSessionProviderStrategy, add a bean,
 * register here.
 */
@Component
public class LiveSessionProviderFactory {

    private final Map<MeetingProvider, LiveSessionProviderStrategy> strategies;

    public LiveSessionProviderFactory(ZohoMeetingManager zoho) {
        this.strategies = Map.of(
                MeetingProvider.ZOHO_MEETING, zoho);
    }

    public LiveSessionProviderStrategy getStrategy(MeetingProvider provider) {
        LiveSessionProviderStrategy strategy = strategies.get(provider);
        if (strategy == null) {
            throw new VacademyException("No live session provider strategy found for: " + provider);
        }
        return strategy;
    }

    public LiveSessionProviderStrategy getStrategy(String providerName) {
        return getStrategy(MeetingProvider.fromString(providerName));
    }
}
