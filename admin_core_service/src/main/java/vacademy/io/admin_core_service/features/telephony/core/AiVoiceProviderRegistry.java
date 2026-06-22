package vacademy.io.admin_core_service.features.telephony.core;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.spi.AiCallReportParser;
import vacademy.io.admin_core_service.features.telephony.spi.AiOutboundCaller;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Spring-driven registry for AI-voice providers — the AI analogue of
 * {@link TelephonyProviderRegistry}. Indexes every {@link AiOutboundCaller} and
 * {@link AiCallReportParser} bean by its {@code providerType()}.
 *
 * Adding a provider = drop the two adapter beans. Nothing here changes (OCP).
 */
@Component
public class AiVoiceProviderRegistry {

    private final Map<String, AiOutboundCaller> callers = new HashMap<>();
    private final Map<String, AiCallReportParser> parsers = new HashMap<>();

    public AiVoiceProviderRegistry(List<AiOutboundCaller> callers, List<AiCallReportParser> parsers) {
        callers.forEach(c -> this.callers.put(c.providerType(), c));
        parsers.forEach(p -> this.parsers.put(p.providerType(), p));
    }

    public AiOutboundCaller caller(String providerType) {
        AiOutboundCaller c = callers.get(providerType);
        if (c == null) throw new VacademyException("No AI-voice caller registered for " + providerType);
        return c;
    }

    public AiCallReportParser parser(String providerType) {
        AiCallReportParser p = parsers.get(providerType);
        if (p == null) throw new VacademyException("No AI-voice report parser registered for " + providerType);
        return p;
    }
}
