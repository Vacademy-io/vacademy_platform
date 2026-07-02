package vacademy.io.admin_core_service.features.telephony.providers.plivo;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.spi.InboundResponseRenderer;
import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundRouteDecision;

import java.util.ArrayList;
import java.util.List;

/**
 * Plivo's synchronous inbound applet for the fallback path — when an institute has
 * NOT authored an IVR menu, the dialled DID still routes the lead to a counsellor /
 * voicemail leg via the standard routing chain. Returns Plivo Answer-XML (a
 * {@code <Dial>} of the decision's numbers, or a polite hang-up when none).
 *
 * <p>The richer multi-level IVR path (with corr-based recording + DTMF) is rendered
 * by {@link PlivoIvrRenderer}; this is only the no-IVR fallback + what satisfies the
 * {@code SYNC_INBOUND_APPLET} capability on the generic {@code /inbound/route} seam.
 */
@Component
public class PlivoInboundResponseRenderer implements InboundResponseRenderer {

    @Override
    public String providerType() {
        return ProviderType.PLIVO;
    }

    @Override
    public Object render(InboundRouteDecision decision, String dialledNumber) {
        List<String> numbers = extractNumbers(decision);
        if (numbers.isEmpty()) {
            return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response>"
                    + "<Speak>Sorry, no one is available to take your call right now. "
                    + "Please call back later.</Speak><Hangup/></Response>";
        }
        int ring = decision.getMaxRingingSeconds() == null ? 30 : decision.getMaxRingingSeconds();
        StringBuilder b = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response>");
        b.append("<Dial callerId=\"").append(esc(dialledNumber)).append("\" timeout=\"").append(ring).append("\">");
        for (String n : numbers) {
            b.append("<Number>").append(esc(n)).append("</Number>");
        }
        b.append("</Dial></Response>");
        return b.toString();
    }

    private static List<String> extractNumbers(InboundRouteDecision decision) {
        List<String> out = new ArrayList<>();
        if (decision == null || decision.getNumbersToDial() == null) return out;
        for (InboundRouteDecision.DialLeg leg : decision.getNumbersToDial()) {
            if (leg != null && leg.getNumber() != null && !leg.getNumber().isBlank()) {
                out.add(leg.getNumber().trim());
            }
        }
        return out;
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }
}
