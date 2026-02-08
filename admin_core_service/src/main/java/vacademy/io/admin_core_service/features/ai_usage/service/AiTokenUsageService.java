package vacademy.io.admin_core_service.features.ai_usage.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.ai_usage.entity.AiTokenUsage;
import vacademy.io.admin_core_service.features.ai_usage.enums.ApiProvider;
import vacademy.io.admin_core_service.features.ai_usage.enums.RequestType;
import vacademy.io.admin_core_service.features.ai_usage.repository.AiTokenUsageRepository;

import java.time.ZonedDateTime;
import java.util.UUID;

/**
 * Service for recording AI token usage.
 * This service provides a centralized way to log AI API usage across all
 * admin_core_service features.
 * 
 * Usage example:
 * 
 * <pre>
 * aiTokenUsageService.recordUsage(
 *         ApiProvider.OPENAI,
 *         RequestType.ANALYTICS,
 *         "google/gemini-2.5-flash",
 *         100, // promptTokens
 *         50, // completionTokens
 *         instituteId,
 *         userId);
 * </pre>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiTokenUsageService {

    private final AiTokenUsageRepository repository;

    /**
     * Record token usage synchronously.
     * 
     * @param apiProvider      API provider (OPENAI or GEMINI)
     * @param requestType      Type of request
     * @param model            Model name (e.g., "google/gemini-2.5-flash")
     * @param promptTokens     Number of input tokens
     * @param completionTokens Number of output tokens
     * @param instituteId      Optional institute UUID
     * @param userId           Optional user UUID
     * @return The saved AiTokenUsage entity
     */
    @Transactional
    public AiTokenUsage recordUsage(
            ApiProvider apiProvider,
            RequestType requestType,
            String model,
            int promptTokens,
            int completionTokens,
            UUID instituteId,
            UUID userId) {
        return recordUsageInternal(
                apiProvider, requestType, model,
                promptTokens, completionTokens,
                instituteId, userId,
                null, null, null, null);
    }

    /**
     * Record token usage asynchronously (fire and forget).
     * Use this when you don't want to block the main thread for usage logging.
     */
    @Async
    @Transactional
    public void recordUsageAsync(
            ApiProvider apiProvider,
            RequestType requestType,
            String model,
            int promptTokens,
            int completionTokens,
            UUID instituteId,
            UUID userId) {
        try {
            recordUsageInternal(
                    apiProvider, requestType, model,
                    promptTokens, completionTokens,
                    instituteId, userId,
                    null, null, null, null);
        } catch (Exception e) {
            log.error("Failed to record AI token usage asynchronously: {}", e.getMessage(), e);
        }
    }

    /**
     * Record token usage with full options.
     * 
     * @param apiProvider      API provider (OPENAI or GEMINI)
     * @param requestType      Type of request
     * @param model            Model name
     * @param promptTokens     Number of input tokens
     * @param completionTokens Number of output tokens
     * @param instituteId      Optional institute UUID
     * @param userId           Optional user UUID
     * @param requestId        Optional request correlation ID
     * @param metadata         Optional JSON metadata string
     * @param ttsProvider      Optional TTS provider (for TTS requests)
     * @param characterCount   Optional character count (for TTS requests)
     * @return The saved AiTokenUsage entity
     */
    @Transactional
    public AiTokenUsage recordUsageFull(
            ApiProvider apiProvider,
            RequestType requestType,
            String model,
            int promptTokens,
            int completionTokens,
            UUID instituteId,
            UUID userId,
            String requestId,
            String metadata,
            String ttsProvider,
            Integer characterCount) {
        return recordUsageInternal(
                apiProvider, requestType, model,
                promptTokens, completionTokens,
                instituteId, userId,
                requestId, metadata, ttsProvider, characterCount);
    }

    /**
     * Record TTS usage specifically.
     * For TTS, we log character count as prompt_tokens for consistency.
     * 
     * @param ttsProvider    TTS provider (google, edge, elevenlabs)
     * @param characterCount Number of characters processed
     * @param instituteId    Institute UUID
     * @param userId         User UUID
     * @return The saved AiTokenUsage entity
     */
    @Transactional
    public AiTokenUsage recordTtsUsage(
            String ttsProvider,
            int characterCount,
            UUID instituteId,
            UUID userId) {
        AiTokenUsage usage = AiTokenUsage.builder()
                .apiProvider(ApiProvider.GEMINI.getValue()) // Use gemini for Google TTS
                .requestType(RequestType.TTS.getValue())
                .model("google-cloud-tts")
                .promptTokens(characterCount) // Use prompt_tokens for character count
                .completionTokens(0)
                .totalTokens(characterCount)
                .instituteId(instituteId)
                .userId(userId)
                .ttsProvider(ttsProvider)
                .characterCount(characterCount)
                .build();

        try {
            return repository.save(usage);
        } catch (Exception e) {
            log.error("Failed to record TTS usage: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Record TTS usage asynchronously.
     */
    @Async
    @Transactional
    public void recordTtsUsageAsync(
            String ttsProvider,
            int characterCount,
            UUID instituteId,
            UUID userId) {
        try {
            recordTtsUsage(ttsProvider, characterCount, instituteId, userId);
        } catch (Exception e) {
            log.error("Failed to record TTS usage asynchronously: {}", e.getMessage(), e);
        }
    }

    /**
     * Internal method to create and save usage record.
     */
    private AiTokenUsage recordUsageInternal(
            ApiProvider apiProvider,
            RequestType requestType,
            String model,
            int promptTokens,
            int completionTokens,
            UUID instituteId,
            UUID userId,
            String requestId,
            String metadata,
            String ttsProvider,
            Integer characterCount) {
        int totalTokens = promptTokens + completionTokens;

        AiTokenUsage usage = AiTokenUsage.builder()
                .apiProvider(apiProvider.getValue())
                .requestType(requestType.getValue())
                .model(model)
                .promptTokens(promptTokens)
                .completionTokens(completionTokens)
                .totalTokens(totalTokens)
                .instituteId(instituteId)
                .userId(userId)
                .requestId(requestId)
                .metadata(metadata)
                .ttsProvider(ttsProvider)
                .characterCount(characterCount)
                .build();

        try {
            AiTokenUsage saved = repository.save(usage);
            log.debug("Recorded AI token usage: {} tokens for {} via {}",
                    totalTokens, requestType.getValue(), apiProvider.getValue());
            return saved;
        } catch (Exception e) {
            log.error("Failed to record AI token usage: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Get total tokens used by an institute in the last N days.
     */
    @Transactional(readOnly = true)
    public long getTotalTokensForInstitute(UUID instituteId, int days) {
        ZonedDateTime endDate = ZonedDateTime.now();
        ZonedDateTime startDate = endDate.minusDays(days);
        return repository.getTotalTokensByInstituteAndDateRange(instituteId, startDate, endDate);
    }

    /**
     * Get total tokens used by a user in the last N days.
     */
    @Transactional(readOnly = true)
    public long getTotalTokensForUser(UUID userId, int days) {
        ZonedDateTime endDate = ZonedDateTime.now();
        ZonedDateTime startDate = endDate.minusDays(days);
        return repository.getTotalTokensByUserAndDateRange(userId, startDate, endDate);
    }
}
