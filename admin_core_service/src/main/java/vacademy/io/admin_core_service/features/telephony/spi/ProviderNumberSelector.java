package vacademy.io.admin_core_service.features.telephony.spi;

import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderNumberView;
import vacademy.io.admin_core_service.features.telephony.spi.dto.SelectionContext;

import java.util.Optional;

/**
 * Picks which provider number (e.g. which ExoPhone) to use as caller-ID for
 * one call. Pluggable strategy — adding a new strategy is one @Component, no
 * controller / orchestrator changes.
 */
public interface ProviderNumberSelector {
    /** Matches institute_telephony_config.default_selector_key. */
    String strategyKey();

    Optional<ProviderNumberView> select(SelectionContext ctx);
}
