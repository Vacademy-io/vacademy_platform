package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Provider-agnostic view of a registered virtual number. The selector strategy
 * sees this, not the JPA entity, so adapters can route by region /
 * priority without coupling to persistence types.
 */
@Value
@Builder
public class ProviderNumberView {
    String id;
    String phoneNumber;
    String label;
    String region;
    int priority;
    boolean enabled;
}
