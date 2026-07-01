package vacademy.io.admin_core_service.features.telephony.providers.plivo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderErrorCode;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.spi.OutboundCallInitiator;
import vacademy.io.admin_core_service.features.telephony.spi.dto.BridgeCallRequest;
import vacademy.io.admin_core_service.features.telephony.spi.dto.OutboundCallHandle;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderError;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Map;

/**
 * Places a Plivo PSTN-bridge call (counsellor-first). Unlike Exotel's single
 * Connect-Two-Numbers call, Plivo dials ONE leg and fetches XML to dial the
 * second, so we wire three callback URLs:
 * <ul>
 *   <li><b>answer_url</b> → our public {@code /telephony/plivo/answer/outbound}
 *       endpoint, which (a) marks COUNSELLOR_ANSWERED and (b) returns
 *       {@code <Dial><Number>lead</Number></Dial>} so Plivo bridges to the lead;</li>
 *   <li><b>ring_url</b> → the status webhook (COUNSELLOR_RINGING);</li>
 *   <li><b>hangup_url</b> → the status webhook (terminal + duration).</li>
 * </ul>
 * The {@code <Dial>}'s own callback/record URLs (added by the answer endpoint)
 * carry the lead-leg IN_PROGRESS event and the recording. All callbacks echo our
 * {@code ?corr=} (CorrelationStrategy.ECHO_FIELD) so they bind to the call-log row.
 */
@Component
public class PlivoOutboundCallInitiator implements OutboundCallInitiator {

    @Autowired private PlivoHttpClient httpClient;

    @Value("${telephony.webhook.callback-base:}")
    private String webhookBase;

    @Override
    public String providerType() {
        return ProviderType.PLIVO;
    }

    @Override
    public OutboundCallHandle initiate(BridgeCallRequest req, ProviderCredentials creds) {
        String plivoNumber = req.getCallerId();   // parent-leg caller-ID = institute's Plivo number
        if (plivoNumber == null || plivoNumber.isBlank()) {
            throw new VacademyException("No Vacademy Voice caller-ID number is configured");
        }
        String counsellor = req.getFrom();         // leg we ring first
        if (counsellor == null || counsellor.isBlank()) {
            throw new VacademyException("Counsellor phone number is missing");
        }
        String corr = req.getCorrelationId();
        String statusBase = req.getStatusCallbackUrl();   // .../webhook/status?provider=PLIVO&corr=..[&token=..]

        String answerUrl = base() + "/admin-core-service/v1/telephony/plivo/answer/outbound?corr=" + corr;
        String ringUrl = appendEvent(statusBase, "ring");
        String hangupUrl = appendEvent(statusBase, "hangup");

        Map<String, Object> resp = httpClient.createCall(creds, plivoNumber, counsellor,
                answerUrl, hangupUrl, ringUrl, req.isRecord(), "45");

        // Plivo's create-call response is {message, request_uuid, api_id}. The stable
        // call_uuid only arrives on the callbacks (we correlate by ?corr=), so we keep
        // request_uuid as a debugging hint on the row.
        String requestUuid = resp == null ? null : asString(resp.get("request_uuid"));
        return OutboundCallHandle.builder()
                .providerCallId(requestUuid)
                .initialStatus("queued")
                .build();
    }

    @Override
    public ProviderError translateError(Exception e) {
        String msg = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
        if (msg.contains("insufficient") || msg.contains("credit") || msg.contains("balance")) {
            return ProviderError.of(ProviderErrorCode.OUT_OF_BALANCE,
                    "This institute's Vacademy Voice balance is exhausted. Top up to continue calling.");
        }
        if (msg.contains("invalid") && msg.contains("number")) {
            return ProviderError.of(ProviderErrorCode.INVALID_NUMBER,
                    "Phone number format rejected by Plivo. Check the caller-ID and lead numbers.");
        }
        if (msg.contains("not a valid") || msg.contains("caller")) {
            return ProviderError.of(ProviderErrorCode.CALLER_ID_UNVERIFIED,
                    "The caller-ID is not a number on this institute's Plivo subaccount.");
        }
        return ProviderError.unknown(null);
    }

    private String base() {
        return (webhookBase == null || webhookBase.isBlank()) ? "https://api.vacademy.io" : webhookBase;
    }

    private static String appendEvent(String url, String event) {
        if (url == null) return null;
        return url + (url.contains("?") ? "&" : "?") + "plivoEvent=" + event;
    }

    private static String asString(Object o) {
        return o == null ? null : o.toString();
    }
}
