package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

/**
 * Inputs an {@code OutboundOriginationResolver} needs to decide the first-leg
 * origination for an outbound call. Provider-neutral: a pooled-number provider
 * (Exotel) uses {@code available}/{@code selectorKey}/{@code preferredNumberId};
 * a per-counsellor-DID provider (Airtel/Vonage) ignores those and derives the
 * {@code from}/caller-ID from {@code counsellorUserId}.
 */
@Value
@Builder
public class OriginationContext {
    String instituteId;
    String providerType;
    String counsellorUserId;
    String leadUserId;
    String leadPhone;
    /** Runtime caller override (pooled providers) — a specific number id, else null. */
    String preferredNumberId;
    /** The institute's selector strategy key (pooled providers). */
    String selectorKey;
    /** Enabled caller-ID numbers (pooled providers). Empty for no-pool providers. */
    List<ProviderNumberView> available;
}
