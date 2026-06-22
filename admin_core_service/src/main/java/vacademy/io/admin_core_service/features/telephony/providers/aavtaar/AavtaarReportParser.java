package vacademy.io.admin_core_service.features.telephony.providers.aavtaar;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.providers.aavtaar.dto.AavtaarCallWebhookRequest;
import vacademy.io.admin_core_service.features.telephony.spi.AiCallReportParser;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallReport;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;
import java.util.Locale;

/**
 * Aavtaar adapter for the {@link AiCallReportParser} port — maps Aavtaar's
 * end-of-call payload (via the lenient {@link AavtaarCallWebhookRequest}) onto
 * the provider-neutral {@link AiCallReport}. All Aavtaar field-name knowledge and
 * date-format quirks live here, not in the core.
 */
@Component
public class AavtaarReportParser implements AiCallReportParser {

    private static final Logger log = LoggerFactory.getLogger(AavtaarReportParser.class);
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Override
    public String providerType() {
        return ProviderType.AAVTAAR;
    }

    @Override
    public AiCallReport parse(JsonNode callNode) {
        AavtaarCallWebhookRequest dto;
        try {
            dto = mapper.treeToValue(callNode, AavtaarCallWebhookRequest.class);
        } catch (Exception e) {
            throw new IllegalArgumentException("Unparseable Aavtaar call payload", e);
        }
        return AiCallReport.builder()
                .provider(ProviderType.AAVTAAR)
                .callUuid(trimToNull(dto.getCallUuid()))
                .correlationId(resolveCorrelationId(dto))
                .direction(normalizeDirection(dto.getCampaignType()))
                .campaignType(dto.getCampaignType())
                .campaignId(dto.getCampaignId())
                .status(dto.getStatus())
                .durationSeconds(dto.getDuration() == null ? null : (int) Math.round(dto.getDuration()))
                .callStart(parseIstLocal(dto.getCallStart()))
                .disposition(dto.getDisposition())
                .leadResponse(dto.getLeadResponse())
                .leadRating(dto.getLeadRating())
                .callRating(dto.getCallRating())
                .interestLevel(dto.getInterestLevel())
                .summary(dto.getAiSummary())
                .extractedQa(dto.getExtra().isEmpty() ? null : dto.getExtra())
                .metadata(dto.getMetadata())
                .recordingUrl(trimToNull(dto.getRecordingUrl()))
                .transcript(trimToNull(dto.getTranscript()))
                .callbackRequested(parseYesNo(dto.getCallback()))
                .callbackAt(parseOffset(dto.getCallbackTimestamp()))
                .callbackTimeText(dto.getCallbackTime())
                .transferAttempted(dto.getTransferCall())
                .ninePressed(dto.getNinePressed())
                .transferStatus(dto.getTransferStatus())
                .transferTriggered(dto.getTransferTriggered())
                .hangupCause(dto.getHangupCause())
                .hangupCode(dto.getHangupCauseCode())
                .hangupSource(dto.getHangupSource())
                .phoneNumber(dto.getPhoneNumber())
                .dialCode(dto.getDialCode())
                .callRetry(dto.getCallRetry())
                .customerName(dto.getCustomerName())
                .customerEmail(dto.getCustomerEmail())
                .rawPayload(callNode.toString())
                .build();
    }

    // ── helpers (Aavtaar-specific) ───────────────────────────────────────────────

    private String resolveCorrelationId(AavtaarCallWebhookRequest dto) {
        if (dto.getCorrelationId() != null) return dto.getCorrelationId();
        if (dto.getMetadata() != null && dto.getMetadata().get("correlationId") != null) {
            return String.valueOf(dto.getMetadata().get("correlationId"));
        }
        return null;
    }

    private String normalizeDirection(String campaignType) {
        if (campaignType == null) return null;
        String c = campaignType.trim().toLowerCase();
        if (c.contains("inbound")) return "INBOUND";
        if (c.contains("outbound")) return "OUTBOUND";
        return null;
    }

    private Boolean parseYesNo(String s) {
        if (s == null) return null;
        String t = s.trim().toLowerCase();
        if (t.equals("yes") || t.equals("true")) return true;
        if (t.equals("no") || t.equals("false")) return false;
        return null;
    }

    /** "2026-06-19T16:00:00.000000+0530" — offset with or without a colon. */
    private Instant parseOffset(String s) {
        s = trimToNull(s);
        if (s == null) return null;
        try {
            DateTimeFormatter f = new DateTimeFormatterBuilder()
                    .appendPattern("yyyy-MM-dd'T'HH:mm:ss")
                    .optionalStart().appendFraction(ChronoField.NANO_OF_SECOND, 0, 9, true).optionalEnd()
                    .optionalStart().appendOffset("+HHMM", "Z").optionalEnd()
                    .optionalStart().appendOffset("+HH:MM", "Z").optionalEnd()
                    .toFormatter(Locale.ENGLISH);
            return OffsetDateTime.parse(s, f).toInstant();
        } catch (Exception e) {
            log.warn("aavtaar parse: bad callback timestamp '{}'", s);
            return null;
        }
    }

    /** "19-06-2026 11:56 AM" — no tz in the payload, assumed IST. */
    private Instant parseIstLocal(String s) {
        s = trimToNull(s);
        if (s == null) return null;
        try {
            DateTimeFormatter f = DateTimeFormatter.ofPattern("dd-MM-yyyy hh:mm a", Locale.ENGLISH);
            return LocalDateTime.parse(s, f).atZone(IST).toInstant();
        } catch (Exception e) {
            log.warn("aavtaar parse: bad call start '{}'", s);
            return null;
        }
    }

    private String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
