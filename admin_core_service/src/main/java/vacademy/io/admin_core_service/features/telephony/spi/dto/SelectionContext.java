package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

/**
 * Inputs every ProviderNumberSelector needs to make a routing decision.
 * Constructed by the orchestrator with enough context that selectors don't
 * have to call back into the database (keeps them deterministic + fast).
 */
@Value
@Builder
public class SelectionContext {
    String instituteId;
    String counsellorUserId;
    String leadUserId;
    String leadPhone;          // raw, used by REGION_MATCH for STD code lookup
    List<ProviderNumberView> available;
    /** For STICKY_PER_LEAD: the most recent provider_number_id this lead saw, if any. */
    String lastProviderNumberIdForLead;
}
