package vacademy.io.admin_core_service.features.telephony.core;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.spi.CallWebhookHandler;
import vacademy.io.admin_core_service.features.telephony.spi.OutboundCallInitiator;
import vacademy.io.admin_core_service.features.telephony.spi.ProviderNumberSelector;
import vacademy.io.admin_core_service.features.telephony.spi.RecordingFetcher;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Spring-driven port registry. Every adapter under {@code providers/<name>/}
 * registers as a Spring bean — this class indexes them by their
 * {@code providerType()} / {@code strategyKey()}.
 *
 * Adding a new provider = drop new beans. No change here.
 */
@Component
public class TelephonyProviderRegistry {

    private final Map<String, OutboundCallInitiator> initiators = new HashMap<>();
    private final Map<String, CallWebhookHandler> handlers = new HashMap<>();
    private final Map<String, RecordingFetcher> fetchers = new HashMap<>();
    private final Map<String, ProviderNumberSelector> selectors = new HashMap<>();

    public TelephonyProviderRegistry(
            List<OutboundCallInitiator> initiators,
            List<CallWebhookHandler> handlers,
            List<RecordingFetcher> fetchers,
            List<ProviderNumberSelector> selectors) {
        initiators.forEach(b -> this.initiators.put(b.providerType(), b));
        handlers.forEach(b -> this.handlers.put(b.providerType(), b));
        fetchers.forEach(b -> this.fetchers.put(b.providerType(), b));
        selectors.forEach(b -> this.selectors.put(b.strategyKey(), b));
    }

    public OutboundCallInitiator initiator(String providerType) {
        OutboundCallInitiator b = initiators.get(providerType);
        if (b == null) throw new VacademyException("No telephony initiator registered for " + providerType);
        return b;
    }

    public CallWebhookHandler handler(String providerType) {
        CallWebhookHandler b = handlers.get(providerType);
        if (b == null) throw new VacademyException("No telephony webhook handler registered for " + providerType);
        return b;
    }

    public Optional<RecordingFetcher> fetcher(String providerType) {
        return Optional.ofNullable(fetchers.get(providerType));
    }

    public ProviderNumberSelector selector(String strategyKey) {
        ProviderNumberSelector b = selectors.get(strategyKey);
        if (b == null) throw new VacademyException("No selector strategy registered for " + strategyKey);
        return b;
    }
}
