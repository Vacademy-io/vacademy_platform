package vacademy.io.admin_core_service.features.telephony.providers.airtel.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/**
 * The subset of an Airtel/Vonage VBC CDR JSON (Cdr/&lt;uuid&gt;.json) we ingest.
 * Unknown fields are ignored — the full body is retained verbatim in
 * {@code airtel_call_import.raw_payload}.
 *
 * <p>Sample (outbound): {@code callDirection:2}, {@code ani}/{@code sourceExtensionNumber}
 * = the counsellor extension, {@code dnis}/{@code dialedNumber} = the lead.
 * Inbound ({@code callDirection:1}) is expected to flip ani/dnis — TBC against a
 * live inbound CDR. Dates ({@code dateStart}/{@code dateEnd}) are UTC
 * ("yyyy-MM-dd HH:mm:ss.SSS"); {@code dateEndInAccountTimezone} is IST.
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
