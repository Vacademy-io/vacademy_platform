package vacademy.io.admin_core_service.features.telephony.core.selector;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.SelectorStrategy;
import vacademy.io.admin_core_service.features.telephony.spi.ProviderNumberSelector;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderNumberView;
import vacademy.io.admin_core_service.features.telephony.spi.dto.SelectionContext;

import java.util.Optional;

/**
 * Default strategy. If this lead has been called before, reuse the same number
 * so they recognise the caller-ID. Otherwise fall through to lowest-priority
 * available number (deterministic — never random for the first call).
 */
@Component
public class StickyPerLeadSelector implements ProviderNumberSelector {

    @Override
    public String strategyKey() {
        return SelectorStrategy.STICKY_PER_LEAD;
    }

    @Override
    public Optional<ProviderNumberView> select(SelectionContext ctx) {
        if (ctx.getAvailable() == null || ctx.getAvailable().isEmpty()) {
            return Optional.empty();
        }
        if (ctx.getLastProviderNumberIdForLead() != null) {
            Optional<ProviderNumberView> sticky = ctx.getAvailable().stream()
                    .filter(n -> ctx.getLastProviderNumberIdForLead().equals(n.getId()))
                    .findFirst();
            if (sticky.isPresent()) return sticky;
            // sticky target was disabled/removed — fall through to fresh pick
        }
        return ctx.getAvailable().stream()
                .min((a, b) -> {
                    int p = Integer.compare(a.getPriority(), b.getPriority());
                    return p != 0 ? p : a.getId().compareTo(b.getId());
                });
    }
}
