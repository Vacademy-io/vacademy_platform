package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiCallResult;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiCallResultRepository;
import vacademy.io.admin_core_service.features.telephony.spi.AiCallReportParser;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallReport;

import java.util.ArrayList;
import java.util.List;

/**
 * Provider-neutral receiver for AI-voice end-of-call webhooks. Handles transport
 * (NaN-sanitising, single-object vs array), resolves the provider's
 * {@link AiCallReportParser} from the registry, and lands each parsed
 * {@link AiCallReport} into the {@code ai_call_result} table (idempotent on
 * {@code (provider, call_uuid)}). The lead-binding + assignment is done
 * afterwards by {@link AiCallOutcomeProcessor}.
 *
 * A new AI provider needs nothing here — only its parser + caller beans.
 */
@Service
@RequiredArgsConstructor
public class AiVoiceWebhookService {

    private static final Logger log = LoggerFactory.getLogger(AiVoiceWebhookService.class);

    private final AiVoiceProviderRegistry registry;
    private final AiCallResultRepository repo;

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            .configure(JsonParser.Feature.ALLOW_NON_NUMERIC_NUMBERS, true);

    public record IngestResult(int received, int updated, int failed, List<String> savedIds) {}

    private record UpsertOutcome(String id, boolean isUpdate) {}

    @Transactional
    public IngestResult ingest(String provider, String instituteId, String rawBody) {
        AiCallReportParser parser = registry.parser(provider); // throws on unknown provider
        int received = 0, updated = 0, failed = 0;
        List<String> savedIds = new ArrayList<>();

        List<JsonNode> calls = new ArrayList<>();
        try {
            JsonNode root = mapper.readTree(sanitize(rawBody));
            if (root.isArray()) root.forEach(calls::add); else calls.add(root);
        } catch (Exception e) {
            log.error("ai-voice webhook: unparseable body provider={} institute={}", provider, instituteId, e);
            captureUnparseable(provider, instituteId, rawBody);
            return new IngestResult(0, 0, 1, savedIds);
        }

        for (JsonNode node : calls) {
            try {
                AiCallReport report = parser.parse(node);
                UpsertOutcome o = upsert(provider, instituteId, report);
                savedIds.add(o.id());
                if (o.isUpdate()) updated++; else received++;
            } catch (Exception e) {
                failed++;
                log.error("ai-voice webhook: failed to map a call provider={} institute={}", provider, instituteId, e);
            }
        }
        return new IngestResult(received, updated, failed, savedIds);
    }

    private UpsertOutcome upsert(String provider, String instituteId, AiCallReport report) {
        String callUuid = report.getCallUuid();
        AiCallResult row = callUuid == null ? null
                : repo.findByProviderAndCallUuid(provider, callUuid).orElse(null);
        boolean isUpdate = row != null;
        if (row == null) row = AiCallResult.builder().provider(provider).build();

        row.setCallUuid(callUuid);
        if (row.getInstituteId() == null) row.setInstituteId(instituteId);
        row.setCorrelationId(report.getCorrelationId());
        row.setWorkflowExecutionId(metaString(report, "workflowExecutionId"));
        row.setDirection(report.getDirection());
        row.setCampaignType(report.getCampaignType());
        row.setCampaignId(report.getCampaignId());
        row.setPhoneNumber(report.getPhoneNumber());
        row.setDialCode(report.getDialCode());
        row.setCallRetry(report.getCallRetry());
        row.setCustomerName(report.getCustomerName());
        row.setCustomerEmail(report.getCustomerEmail());
        row.setStatus(report.getStatus());
        row.setDisposition(report.getDisposition());
        row.setLeadResponse(report.getLeadResponse());
        row.setLeadRating(report.getLeadRating());
        row.setCallRating(report.getCallRating());
        row.setInterestLevel(report.getInterestLevel());
        row.setAiSummary(report.getSummary());
        row.setExtractedQa(report.getExtractedQa());
        row.setMetadata(report.getMetadata());
        row.setCallback(report.getCallbackRequested());
        row.setCallbackAt(report.getCallbackAt());
        row.setCallbackTimeText(report.getCallbackTimeText());
        row.setTransferCall(report.getTransferAttempted());
        row.setNinePressed(report.getNinePressed());
        row.setTransferStatus(report.getTransferStatus());
        row.setTransferTriggered(report.getTransferTriggered());
        row.setHangupCause(report.getHangupCause());
        row.setHangupCode(report.getHangupCode());
        row.setHangupSource(report.getHangupSource());
        row.setRecordingUrl(report.getRecordingUrl());
        row.setDurationSeconds(report.getDurationSeconds());
        row.setCallStart(report.getCallStart());
        row.setTranscript(report.getTranscript());
        row.setRawPayload(report.getRawPayload());

        repo.save(row);
        return new UpsertOutcome(row.getId(), isUpdate);
    }

    private String metaString(AiCallReport report, String key) {
        if (report.getMetadata() != null && report.getMetadata().get(key) != null) {
            return String.valueOf(report.getMetadata().get(key));
        }
        return null;
    }

    private void captureUnparseable(String provider, String instituteId, String rawBody) {
        try {
            repo.save(AiCallResult.builder()
                    .provider(provider)
                    .instituteId(instituteId)
                    .rawPayload(rawBody == null ? "" : rawBody)
                    .processingStatus("PARSE_FAILED")
                    .build());
        } catch (Exception e) {
            log.error("ai-voice webhook: failed to capture unparseable body", e);
        }
    }

    /** Pandas/JS exports sometimes emit bare NaN tokens which are invalid JSON. */
    private String sanitize(String body) {
        if (body == null) return "{}";
        return body.replaceAll("(?<=[:\\[,]\\s{0,8})NaN", "null");
    }
}
