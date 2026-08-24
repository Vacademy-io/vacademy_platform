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
 *
 * <p><b>Recording.</b> This is the busiest inbound path in production — an institute
 * with a Plivo DID but no authored IVR menu lands EVERY inbound call here — so it
 * emits the same {@code <Record>} the outbound bridge and the IVR DIAL node use.
 * It needs the call's status-callback base to do so (the recording callback is bound
 * to the row by {@code ?corr=}), which the SPI signature cannot carry; the
 * three-arg {@link #render(InboundRouteDecision, String, String)} overload takes it
 * and is what {@link PlivoCallbackController} calls. The SPI two-arg form — reached
 * only from the generic {@code /inbound/route} seam, which has no call-log id in
 * hand — degrades to a non-recorded {@code <Dial>} rather than emitting a
 * {@code <Record>} whose callback could never be attributed to a call.
 */
@Component
public class PlivoInboundResponseRenderer implements InboundResponseRenderer {

    @Override
    public String providerType() {
        return ProviderType.PLIVO;
    }

    @Override
    public Object render(InboundRouteDecision decision, String dialledNumber) {
        // No corr in scope on this seam → no attributable recording callback. See class doc.
        return render(decision, dialledNumber, null);
    }

    /**
     * @param statusBase the call's status-webhook base
     *                   ({@code …/webhook/status?provider=PLIVO&corr=…[&token=…]}), or
     *                   null when the caller has no call-log id to correlate against.
     *                   Recording is emitted only when it is present AND the decision
     *                   says to record.
     */
    public String render(InboundRouteDecision decision, String dialledNumber, String statusBase) {
        List<String> numbers = extractNumbers(decision);
        if (numbers.isEmpty()) {
            return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response>"
                    + "<Speak>Sorry, no one is available to take your call right now. "
                    + "Please call back later.</Speak><Hangup/></Response>";
        }
        int ring = decision.getMaxRingingSeconds() == null ? 30 : decision.getMaxRingingSeconds();
        // Plivo/carrier rejects '+'-prefixed numbers ("Internal Error From Carrier").
        StringBuilder b = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response>");
        // <Record> is a SIBLING before <Dial> — Plivo's <Dial> has no record attribute.
        if (statusBase != null && decision != null && decision.isRecord()) {
            b.append(PlivoRecordXml.bridgeRecord(statusBase));
        }
        b.append("<Dial callerId=\"").append(esc(stripPlus(dialledNumber))).append("\" timeout=\"").append(ring).append("\">");
        for (String n : numbers) {
            b.append("<Number>").append(esc(stripPlus(n))).append("</Number>");
        }
        b.append("</Dial></Response>");
        return b.toString();
    }

    private static String stripPlus(String s) {
        return s != null && s.startsWith("+") ? s.substring(1) : s;
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
