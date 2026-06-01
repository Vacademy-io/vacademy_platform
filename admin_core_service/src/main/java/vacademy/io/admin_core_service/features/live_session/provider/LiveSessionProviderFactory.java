package vacademy.io.admin_core_service.features.live_session.provider;

import org.springframework.stereotype.Component;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.meeting.enums.MeetingProvider;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Resolves the correct {@link LiveSessionProviderStrategy} by {@link MeetingProvider}.
 *
 * Strategies are auto-discovered: Spring injects every {@code LiveSessionProviderStrategy}
 * bean and they are keyed by {@link LiveSessionProviderStrategy#getProviderName()}.
 * To add a new provider you only implement the interface and annotate the bean —
 * no edit here is required.
 */
@Component
public class LiveSessionProviderFactory {

    private final Map<MeetingProvider, LiveSessionProviderStrategy> strategies;

    public LiveSessionProviderFactory(List<LiveSessionProviderStrategy> strategyBeans) {
        Map<MeetingProvider, LiveSessionProviderStrategy> map = new EnumMap<>(MeetingProvider.class);
        for (LiveSessionProviderStrategy strategy : strategyBeans) {
            map.put(MeetingProvider.fromString(strategy.getProviderName()), strategy);
        }
        this.strategies = map;
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
