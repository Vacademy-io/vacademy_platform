package vacademy.io.admin_core_service.features.telephony.core;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.spi.CallWebhookHandler;
import vacademy.io.admin_core_service.features.telephony.spi.InboundFlowBinder;
import vacademy.io.admin_core_service.features.telephony.spi.InboundResponseRenderer;
import vacademy.io.admin_core_service.features.telephony.spi.OutboundCallInitiator;
import vacademy.io.admin_core_service.features.telephony.spi.OutboundOriginationResolver;
import vacademy.io.admin_core_service.features.telephony.spi.ProviderNumberSelector;
import vacademy.io.admin_core_service.features.telephony.spi.RecordingFetcher;
import vacademy.io.admin_core_service.features.telephony.spi.TelephonyProviderDescriptor;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
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
    private final Map<String, TelephonyProviderDescriptor> descriptors = new HashMap<>();
    private final Map<String, InboundResponseRenderer> inboundRenderers = new HashMap<>();
    private final Map<String, InboundFlowBinder> flowBinders = new HashMap<>();
    private final Map<String, OutboundOriginationResolver> originationResolvers = new HashMap<>();

    public TelephonyProviderRegistry(
            List<OutboundCallInitiator> initiators,
            List<CallWebhookHandler> handlers,
            List<RecordingFetcher> fetchers,
            List<ProviderNumberSelector> selectors,
            List<TelephonyProviderDescriptor> descriptors,
            List<InboundResponseRenderer> inboundRenderers,
            List<InboundFlowBinder> flowBinders,
            List<OutboundOriginationResolver> originationResolvers) {
        initiators.forEach(b -> putUnique(this.initiators, b.providerType(), b, "OutboundCallInitiator"));
        handlers.forEach(b -> putUnique(this.handlers, b.providerType(), b, "CallWebhookHandler"));
        fetchers.forEach(b -> putUnique(this.fetchers, b.providerType(), b, "RecordingFetcher"));
        selectors.forEach(b -> putUnique(this.selectors, b.strategyKey(), b, "ProviderNumberSelector"));
        descriptors.forEach(b -> putUnique(this.descriptors, b.providerType(), b, "TelephonyProviderDescriptor"));
        inboundRenderers.forEach(b -> putUnique(this.inboundRenderers, b.providerType(), b, "InboundResponseRenderer"));
        flowBinders.forEach(b -> putUnique(this.flowBinders, b.providerType(), b, "InboundFlowBinder"));
        originationResolvers.forEach(b -> putUnique(this.originationResolvers, b.providerType(), b, "OutboundOriginationResolver"));
    }

    /** Fail fast at startup if two beans claim the same key (copy-paste mistake). */
    private static <T> void putUnique(Map<String, T> map, String key, T bean, String what) {
        if (map.putIfAbsent(key, bean) != null) {
            throw new IllegalStateException("Duplicate telephony " + what + " registered for '" + key + "'");
        }
    }

    public OutboundCallInitiator initiator(String providerType) {
        OutboundCallInitiator b = initiators.get(providerType);
        if (b == null) throw new VacademyException("No telephony initiator registered for " + providerType);
        return b;
    }

    public OutboundOriginationResolver originationResolver(String providerType) {
        OutboundOriginationResolver b = originationResolvers.get(providerType);
        if (b == null) throw new VacademyException("No origination resolver registered for " + providerType);
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

    /** Self-description (capabilities + credential schema) for a provider, if registered. */
    public Optional<TelephonyProviderDescriptor> descriptor(String providerType) {
        return Optional.ofNullable(descriptors.get(providerType));
    }

    /** True if any adapter is registered for this provider type. */
    public boolean isSupported(String providerType) {
        return descriptors.containsKey(providerType) || initiators.containsKey(providerType);
    }

    /** All registered provider descriptors — drives the admin provider dropdown. */
    public List<TelephonyProviderDescriptor> descriptors() {
        return new ArrayList<>(descriptors.values());
    }

    /** Synchronous inbound-applet renderer for a provider, if it has one. Absent
     *  = the provider routes inbound natively (no applet to render). */
    public Optional<InboundResponseRenderer> inboundResponseRenderer(String providerType) {
        return Optional.ofNullable(inboundRenderers.get(providerType));
    }

    /** Inbound-flow binder for a provider, if it needs per-number attach. Absent
     *  = the provider's numbers route inbound natively (nothing to attach). */
    public Optional<InboundFlowBinder> flowBinder(String providerType) {
        return Optional.ofNullable(flowBinders.get(providerType));
    }
}
