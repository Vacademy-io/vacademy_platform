package vacademy.io.admin_core_service.features.telephony.core.selector;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.SelectorStrategy;
import vacademy.io.admin_core_service.features.telephony.spi.ProviderNumberSelector;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderNumberView;
import vacademy.io.admin_core_service.features.telephony.spi.dto.SelectionContext;

import java.util.Optional;

/**
 * Match the lead's STD/country prefix against TelephonyProviderNumber.region.
 * Free-form on both sides — admin sets `region` to whatever string they want
 * to match (e.g. "DL", "MH", "+91-080"). The lead's number is normalised to
 * digits before comparison.
 *
 * Fallback: lowest-priority enabled number when no region matches.
 */
@Component
public class RegionMatchSelector implements ProviderNumberSelector {

    @Override
    public String strategyKey() {
        return SelectorStrategy.REGION_MATCH;
    }

    @Override
    public Optional<ProviderNumberView> select(SelectionContext ctx) {
        if (ctx.getAvailable() == null || ctx.getAvailable().isEmpty()) {
            return Optional.empty();
        }
        String leadDigits = digitsOnly(ctx.getLeadPhone());

        Optional<ProviderNumberView> regionHit = ctx.getAvailable().stream()
                .filter(n -> n.getRegion() != null && !n.getRegion().isBlank())
                .filter(n -> leadDigits.contains(digitsOnly(n.getRegion())))
                .min((a, b) -> Integer.compare(a.getPriority(), b.getPriority()));
        if (regionHit.isPresent()) return regionHit;

        return ctx.getAvailable().stream()
                .min((a, b) -> Integer.compare(a.getPriority(), b.getPriority()));
    }

    private static String digitsOnly(String s) {
        return s == null ? "" : s.replaceAll("\\D+", "");
    }
}
