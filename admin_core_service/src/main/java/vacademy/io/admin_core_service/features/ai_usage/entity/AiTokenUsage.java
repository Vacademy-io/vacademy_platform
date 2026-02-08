package vacademy.io.admin_core_service.features.ai_usage.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

/**
 * Entity for tracking AI token usage across all services.
 * This table logs usage for OpenRouter, Gemini, and Google TTS APIs.
 * 
 * Note: The table is created via Flyway migrations, not JPA auto-generate.
 */
@Entity
@Table(name = "ai_token_usage", indexes = {
        @Index(name = "idx_ai_token_usage_institute_id", columnList = "institute_id"),
        @Index(name = "idx_ai_token_usage_user_id", columnList = "user_id"),
        @Index(name = "idx_ai_token_usage_api_provider", columnList = "api_provider"),
        @Index(name = "idx_ai_token_usage_request_type", columnList = "request_type"),
        @Index(name = "idx_ai_token_usage_created_at", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiTokenUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "institute_id")
    private UUID instituteId;

    @Column(name = "user_id")
    private UUID userId;

    /**
     * API provider: openai, gemini
     * OpenRouter calls are logged as 'openai' since they use OpenAI-compatible API
     */
    @Column(name = "api_provider", nullable = false, length = 50)
    private String apiProvider;

    /**
     * Model name, e.g., "google/gemini-2.5-flash", "openai/gpt-4o-mini"
     */
    @Column(name = "model", length = 255)
    private String model;

    /**
     * Number of input/prompt tokens
     */
    @Column(name = "prompt_tokens", nullable = false)
    @Builder.Default
    private Integer promptTokens = 0;

    /**
     * Number of output/completion tokens
     */
    @Column(name = "completion_tokens", nullable = false)
    @Builder.Default
    private Integer completionTokens = 0;

    /**
     * Total tokens (prompt_tokens + completion_tokens)
     */
    @Column(name = "total_tokens", nullable = false)
    @Builder.Default
    private Integer totalTokens = 0;

    /**
     * Price per input token for this model
     */
    @Column(name = "input_token_price", precision = 20, scale = 10)
    private BigDecimal inputTokenPrice;

    /**
     * Price per output token for this model
     */
    @Column(name = "output_token_price", precision = 20, scale = 10)
    private BigDecimal outputTokenPrice;

    /**
     * Total calculated price
     */
    @Column(name = "total_price", precision = 20, scale = 10)
    private BigDecimal totalPrice;

    /**
     * Request type: outline, image, content, video, tts, embedding, evaluation,
     * presentation, conversation, lecture, course_content, pdf_questions, agent,
     * analytics, copilot
     */
    @Column(name = "request_type", nullable = false, length = 50)
    private String requestType;

    /**
     * Optional request correlation ID
     */
    @Column(name = "request_id", length = 255)
    private String requestId;

    /**
     * Optional JSON metadata
     */
    @Column(name = "metadata", length = 500)
    private String metadata;

    /**
     * TTS provider for TTS requests: google, edge, elevenlabs
     */
    @Column(name = "tts_provider", length = 50)
    private String ttsProvider;

    /**
     * Character count for TTS requests (TTS is charged by character, not token)
     */
    @Column(name = "character_count")
    private Integer characterCount;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private ZonedDateTime createdAt;

    /**
     * Convenience method to calculate total tokens if not already set.
     */
    @PrePersist
    public void prePersist() {
        if (totalTokens == null || totalTokens == 0) {
            totalTokens = (promptTokens != null ? promptTokens : 0)
                    + (completionTokens != null ? completionTokens : 0);
        }
    }
}
