package vacademy.io.admin_core_service.features.telephony.core.inbound;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyConfigCache;
import vacademy.io.admin_core_service.features.telephony.enums.InboundRouterStrategy;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;
import vacademy.io.admin_core_service.features.telephony.spi.InboundLeadRouter;
import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundRouteDecision;
import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundRouteRequest;

import java.util.List;
import java.util.Optional;

/**
 * Final-fallback strategy — return the institute's configured voicemail
 * number. Triggered when every counsellor-routing strategy in the chain has
 * fallen through (no prior outbound call, all candidate counsellors opted
 * out, etc.).
 *
 * When no voicemail number is configured, returns empty too. The routing
 * service will then emit an empty decision and the controller drops the
 * call to the provider's default "no agents available" handling. We still
 * log a missed-call timeline event either way.
 */
@Component
public class VoicemailFallbackInboundRouter implements InboundLeadRouter {

    @Autowired private TelephonyConfigCache configCache;

    @Override
    public String strategyKey() {
        return InboundRouterStrategy.VOICEMAIL_FALLBACK;
    }

    @Override
    public Optional<InboundRouteDecision> route(InboundRouteRequest req) {
        if (req.getInstituteId() == null) return Optional.empty();

        Optional<TelephonyConfigCache.Resolved> resolved = configCache.get(req.getInstituteId());
        if (resolved.isEmpty()) return Optional.empty();

        InstituteTelephonyConfig cfg = resolved.get().getConfig();
        String voicemail = cfg == null ? null : cfg.getInboundVoicemailNumber();
        if (voicemail == null || voicemail.isBlank()) return Optional.empty();

        InboundRouteDecision.DialLeg leg = InboundRouteDecision.DialLeg.builder()
                .number(voicemail.trim())
                .counsellorUserId(null)
                .label("Voicemail")
                .build();

        return Optional.of(InboundRouteDecision.builder()
                .strategyKey(strategyKey())
                .attributedCounsellorUserId(null)
                .numbersToDial(List.of(leg))
                .reason("No counsellor available — falling back to institute voicemail")
                .build());
    }
}
