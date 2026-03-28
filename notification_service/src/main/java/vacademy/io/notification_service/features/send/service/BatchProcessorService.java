package vacademy.io.notification_service.features.send.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.send.dto.UnifiedSendRequest;
import vacademy.io.notification_service.features.send.dto.UnifiedSendResponse;
import vacademy.io.notification_service.features.send.entity.SendBatch;
import vacademy.io.notification_service.features.send.repository.SendBatchRepository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Separate bean so Spring's @Async proxy works (avoids self-invocation issue).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BatchProcessorService {

    private final SendBatchRepository sendBatchRepository;
    private final ObjectMapper objectMapper;

    // Injected lazily to avoid circular dependency — set by UnifiedSendService
    private SendChannelRouter channelRouter;

    public void setChannelRouter(SendChannelRouter channelRouter) {
        this.channelRouter = channelRouter;
    }

    @Async
    public void processAsyncBatch(String batchId) {
        if (channelRouter == null) {
            log.error("BatchProcessorService.channelRouter not initialized yet for batch {}", batchId);
            sendBatchRepository.findById(batchId).ifPresent(batch -> {
                batch.setStatus("FAILED");
                batch.setErrorMessage("Internal error: channel router not initialized");
                batch.setCompletedAt(LocalDateTime.now());
                sendBatchRepository.save(batch);
            });
            return;
        }
        try {
            SendBatch batch = sendBatchRepository.findById(batchId).orElse(null);
            if (batch == null || !"QUEUED".equals(batch.getStatus())) return;

            batch.setStatus("PROCESSING");
            sendBatchRepository.save(batch);

            UnifiedSendRequest request = objectMapper.readValue(
                    batch.getRequestPayload(), UnifiedSendRequest.class);

            List<UnifiedSendRequest.Recipient> allRecipients = request.getRecipients();
            List<UnifiedSendResponse.RecipientResult> allResults = new ArrayList<>();
            int chunkSize = 50;

            for (int i = 0; i < allRecipients.size(); i += chunkSize) {
                int end = Math.min(i + chunkSize, allRecipients.size());
                List<UnifiedSendRequest.Recipient> chunk = allRecipients.subList(i, end);

                UnifiedSendRequest chunkRequest = UnifiedSendRequest.builder()
                        .instituteId(request.getInstituteId())
                        .channel(request.getChannel())
                        .templateName(request.getTemplateName())
                        .languageCode(request.getLanguageCode())
                        .recipients(chunk)
                        .options(request.getOptions())
                        .build();

                UnifiedSendResponse chunkResponse = channelRouter.routeSync(chunkRequest);
                if (chunkResponse.getResults() != null) {
                    allResults.addAll(chunkResponse.getResults());
                }

                // Update progress
                int sent = (int) allResults.stream()
                        .filter(UnifiedSendResponse.RecipientResult::isSuccess).count();
                batch.setSentCount(sent);
                batch.setFailedCount(allResults.size() - sent);
                sendBatchRepository.save(batch);

                // Rate limit between chunks
                if (end < allRecipients.size()) {
                    try {
                        Thread.sleep(200);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        log.warn("Batch {} processing interrupted", batchId);
                        break;
                    }
                }
            }

            batch.setStatus(batch.getFailedCount() == 0 ? "COMPLETED" : "PARTIAL");
            batch.setCompletedAt(LocalDateTime.now());
            batch.setResultsPayload(objectMapper.writeValueAsString(allResults));
            sendBatchRepository.save(batch);

            log.info("Batch {} completed: sent={}, failed={}",
                    batchId, batch.getSentCount(), batch.getFailedCount());

        } catch (Exception e) {
            log.error("Async batch processing failed for {}: {}", batchId, e.getMessage(), e);
            sendBatchRepository.findById(batchId).ifPresent(batch -> {
                batch.setStatus("FAILED");
                batch.setErrorMessage(e.getMessage());
                batch.setCompletedAt(LocalDateTime.now());
                sendBatchRepository.save(batch);
            });
        }
    }
}
