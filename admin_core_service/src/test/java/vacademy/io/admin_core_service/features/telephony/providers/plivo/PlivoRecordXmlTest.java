package vacademy.io.admin_core_service.features.telephony.providers.plivo;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.List;
import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundRouteDecision;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pins the recording contract for Plivo bridge XML.
 *
 * <p>These assertions exist because the previous markup —
 * {@code <Dial record="true" recordCallbackUrl="…">} — is valid-looking XML that
 * Plivo silently ignores ({@code <Dial>} has no record attribute; that is Twilio's
 * API). Nothing failed, no error was logged, and every outbound human Plivo call
 * on the platform recorded nothing for months. A unit test is the only cheap place
 * to catch a regression back to attribute-style recording.
 */
class PlivoRecordXmlTest {

    private static final String STATUS_BASE =
            "https://backend-stage.vacademy.io/admin-core-service/v1/telephony/webhook/status"
                    + "?provider=PLIVO&corr=94eed0fd-1802-4b28-98d8-352e688c664b&token=s3cret";

    @Test
    void recordingIsAnElementNeverADialAttribute() {
        String xml = PlivoRecordXml.bridgeRecord(STATUS_BASE);
        assertTrue(xml.startsWith("<Record "), "recording must be its own <Record> element: " + xml);
        assertFalse(xml.contains("recordCallbackUrl"),
                "recordCallbackUrl is a Twilio-ism Plivo ignores");
    }

    @Test
    void startsOnDialAnswerSoUnansweredCallsProduceNoRecordEvent() {
        // PlivoCallWebhookHandler maps ANY RecordUrl to COMPLETED, so a recording that
        // began before the lead picked up could flip a genuine NO_ANSWER row.
        assertTrue(PlivoRecordXml.bridgeRecord(STATUS_BASE).contains("startOnDialAnswer=\"true\""));
    }

    @Test
    void capIsSetExplicitlyBecausePlivoDefaultsToSixtySeconds() {
        String xml = PlivoRecordXml.bridgeRecord(STATUS_BASE);
        assertTrue(xml.contains("maxLength=\""), "maxLength must be explicit — Plivo's default is 60s");
        int max = Integer.parseInt(xml.replaceAll("(?s).*maxLength=\"(\\d+)\".*", "$1"));
        // 19% of answered Plivo calls run past a minute; the longest to date is 985s.
        assertTrue(max >= 1800, "cap of " + max + "s would truncate real conversations");
    }

    @Test
    void notifiesOnCallbackUrlNotActionUrl() {
        // action fires when recording STARTS (RecordingDuration=-1, file not yet written);
        // RecordingPersistenceService begins fetching 30s later and would race it.
        String xml = PlivoRecordXml.bridgeRecord(STATUS_BASE);
        assertTrue(xml.contains("callbackUrl=\""), "must use callbackUrl (fires when mp3 is ready)");
        assertFalse(xml.contains(" action=\""), "action fires at recording start — too early to fetch");
        assertTrue(xml.contains("redirect=\"false\""), "call flow must stay with <Dial>");
    }

    @Test
    void callbackCarriesTheEventHintAndIsXmlEscaped() {
        String xml = PlivoRecordXml.bridgeRecord(STATUS_BASE);
        // PlivoCallWebhookHandler routes on ?plivoEvent=; the URL's & must be escaped
        // or Plivo rejects the whole document.
        assertTrue(xml.contains("plivoEvent=record"));
        assertFalse(xml.replace("&amp;", "").contains("&"), "raw & in XML attribute: " + xml);
        assertTrue(xml.contains("corr=94eed0fd-1802-4b28-98d8-352e688c664b"));
    }

    /**
     * The whole point: {@code <Record>} must PRECEDE {@code <Dial>} in the served
     * document. Order is the contract — a Record after the Dial would only start
     * once the bridge had already ended.
     */
    @Test
    void bridgeXmlPutsRecordBeforeDialAndParses() throws Exception {
        String xml = renderBridge(true);

        int rec = xml.indexOf("<Record"), dial = xml.indexOf("<Dial");
        assertTrue(rec > 0, "no <Record> in recorded bridge: " + xml);
        assertTrue(rec < dial, "<Record> must precede <Dial>: " + xml);

        // Plivo hangs up on malformed XML, so prove it actually parses.
        org.w3c.dom.Document doc = DocumentBuilderFactory.newInstance().newDocumentBuilder()
                .parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        NodeList kids = doc.getDocumentElement().getChildNodes();
        assertEquals("Response", doc.getDocumentElement().getNodeName());
        assertEquals("Record", firstElement(kids, 0).getNodeName());
        assertEquals("Dial", firstElement(kids, 1).getNodeName());
        // Dial must NOT carry recording attributes — Plivo ignores them.
        Node dialNode = firstElement(kids, 1);
        assertNull(dialNode.getAttributes().getNamedItem("record"));
        assertNull(dialNode.getAttributes().getNamedItem("recordCallbackUrl"));
    }

    /** Recording off (institute opted out, or the AI handoff leg) emits no <Record>. */
    @Test
    void bridgeXmlOmitsRecordWhenRecordingIsOff() throws Exception {
        String xml = renderBridge(false);
        assertFalse(xml.contains("<Record"), xml);
        assertTrue(xml.contains("<Dial"), xml);
    }

    private static Node firstElement(NodeList kids, int index) {
        int seen = 0;
        for (int i = 0; i < kids.getLength(); i++) {
            if (kids.item(i).getNodeType() == Node.ELEMENT_NODE && seen++ == index) return kids.item(i);
        }
        return fail("no element at index " + index);
    }

    private static String renderBridge(boolean record) throws Exception {
        Method m = PlivoCallbackController.class.getDeclaredMethod(
                "buildDialXml", String.class, String.class, String.class, boolean.class);
        m.setAccessible(true);
        return (String) m.invoke(new PlivoCallbackController(),
                "+918031448921", "+917042693967", STATUS_BASE, record);
    }

    // ---- no-IVR inbound fallback: the path every institute without an IVR menu takes.

    @Test
    void noIvrInboundBridgeRecordsWhenGivenAStatusBase() throws Exception {
        String xml = (String) new PlivoInboundResponseRenderer()
                .render(decision(true), "918031448921", STATUS_BASE);
        int rec = xml.indexOf("<Record"), dial = xml.indexOf("<Dial");
        assertTrue(rec > 0 && rec < dial, "<Record> must precede <Dial>: " + xml);
        assertTrue(xml.contains("plivoEvent=record"), xml);
    }

    @Test
    void noIvrInboundBridgeSkipsRecordWhenInstituteOptedOut() throws Exception {
        String xml = (String) new PlivoInboundResponseRenderer()
                .render(decision(false), "918031448921", STATUS_BASE);
        assertFalse(xml.contains("<Record"), xml);
    }

    /**
     * The SPI two-arg form has no call-log id, so a recording callback could not be
     * attributed to a row — it must degrade to a plain <Dial>, not emit an orphan.
     */
    @Test
    void spiFormWithoutCorrEmitsNoOrphanRecording() {
        String xml = (String) new PlivoInboundResponseRenderer()
                .render(decision(true), "918031448921");
        assertFalse(xml.contains("<Record"), xml);
        assertTrue(xml.contains("<Dial"), xml);
    }

    private static InboundRouteDecision decision(boolean record) {
        return InboundRouteDecision.builder()
                .numbersToDial(List.of(
                        InboundRouteDecision.DialLeg.builder().number("+917042693967").build()))
                .maxRingingSeconds(30)
                .record(record)
                .build();
    }
}
