package vacademy.io.admin_core_service.features.telephony.providers.airtel;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCounsellorEndpoint;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCounsellorEndpointRepository;
import vacademy.io.admin_core_service.features.telephony.spi.OutboundOriginationResolver;
import vacademy.io.admin_core_service.features.telephony.spi.dto.OriginationContext;
import vacademy.io.admin_core_service.features.telephony.spi.dto.OriginationPlan;
import vacademy.io.common.exceptions.VacademyException;

/**
 * Airtel origination: no number pool. The counsellor's own VBC extension is the
 * first leg ({@code from}); the lead sees the counsellor's DID as caller-ID.
 * Both come from {@code telephony_counsellor_endpoint} (the extension map).
 */
@Component
public class AirtelOriginationResolver implements OutboundOriginationResolver {

    @Autowired private TelephonyCounsellorEndpointRepository endpointRepo;

    @Override
    public String providerType() {
        return ProviderType.AIRTEL;
    }

    @Override
    public OriginationPlan resolve(OriginationContext ctx) {
        TelephonyCounsellorEndpoint ep = endpointRepo
                .findByCounsellorUserIdAndProviderType(ctx.getCounsellorUserId(), ProviderType.AIRTEL)
                .filter(e -> Boolean.TRUE.equals(e.getEnabled()))
                .orElseThrow(() -> new VacademyException(
                        "This counsellor has no Airtel extension mapped — add one in Calling settings."));
        if (ep.getExtension() == null || ep.getExtension().isBlank()) {
            throw new VacademyException("This counsellor's Airtel extension is not set.");
        }
        return OriginationPlan.builder()
                .from(ep.getExtension())
                .callerId(ep.getDid())   // lead sees the counsellor's DID (may be null)
                .providerNumberId(null)  // no pool
                .build();
    }
}
