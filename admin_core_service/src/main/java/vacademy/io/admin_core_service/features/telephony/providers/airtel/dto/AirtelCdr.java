package vacademy.io.admin_core_service.features.telephony.providers.airtel.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/**
 * The subset of an Airtel/Vonage VBC CDR JSON (Cdr/&lt;uuid&gt;.json) we ingest.
 * Unknown fields are ignored — the full body is retained verbatim in
 * {@code airtel_call_import.raw_payload}.
 *
 * <p>Outbound ({@code callDirection:2}): {@code source*} = the counsellor
 * ({@code sourceExtensionNumber}), {@code dnis}/{@code dialedNumber} = the lead.
 * Inbound ({@code callDirection:1}, confirmed against a live CDR): {@code ani} =
 * the lead, and the counsellor is the DESTINATION — {@code destExtensionNumber}/
 * {@code destUserId} (the {@code source*} fields are absent inbound). Dates
 * ({@code dateStart}/{@code dateEnd}) are UTC ("yyyy-MM-dd HH:mm:ss.SSS");
 * {@code dateEndInAccountTimezone} is IST.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AirtelCdr {
    private Boolean isRecorded;
    private Long accountId;
    private String callId;
    private String cdrId;
    /** 1 = INBOUND, 2 = OUTBOUND (per the outbound sample; inbound TBC). */
    private Integer callDirection;
    private String disposition;

    private String sourceExtensionNumber;
    private String sourceUserId;
    private String sourceUserFullName;

    // Destination (callee) identity. On INBOUND the counsellor is the destination
    // (the source is the external lead), so THESE — not the source* fields — carry
    // the counsellor's extension/user that maps to telephony_counsellor_endpoint.
    private String destExtensionNumber;
    private String destUserId;
    private String destUserFullName;

    private String callerIdNumber;
    private String outboundCallerId;
    /** ANI — for outbound this is the source extension; for inbound, the lead. */
    private String ani;
    /** DNIS — for outbound this is the dialled lead number; for inbound, our DID. */
    private String dnis;
    private String dialedNumber;

    private String dateStart;
    private String dateEnd;
    private String dateEndInAccountTimezone;
}
