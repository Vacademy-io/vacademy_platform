package vacademy.io.admin_core_service.features.telephony.core.selector;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.SelectorStrategy;
import vacademy.io.admin_core_service.features.telephony.spi.ProviderNumberSelector;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderNumberView;
import vacademy.io.admin_core_service.features.telephony.spi.dto.SelectionContext;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Per-institute round-robin over enabled numbers. State is an in-memory counter
 * keyed by instituteId — good enough for the single-pod default; multi-pod
 * deployments can swap in a Redis-backed counter behind the same SPI without
 * touching anything else.
 */
@Component
public class RoundRobinSelector implements ProviderNumberSelector {

    private final ConcurrentHashMap<String, AtomicInteger> counters = new ConcurrentHashMap<>();

    @Override
    public String strategyKey() {
        return SelectorStrategy.ROUND_ROBIN;
    }

    @Override
    public Optional<ProviderNumberView> select(SelectionContext ctx) {
        List<ProviderNumberView> ns = ctx.getAvailable();
        if (ns == null || ns.isEmpty()) return Optional.empty();

        // available is already sorted by (priority, id) at the repo layer.
        AtomicInteger c = counters.computeIfAbsent(ctx.getInstituteId(), k -> new AtomicInteger());
        int idx = Math.floorMod(c.getAndIncrement(), ns.size());
        return Optional.of(ns.get(idx));
    }
}
