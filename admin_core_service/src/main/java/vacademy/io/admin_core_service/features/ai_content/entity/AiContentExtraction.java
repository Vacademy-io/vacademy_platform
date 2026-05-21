package vacademy.io.admin_core_service.features.ai_content.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/**
 * Intermediate processed form of a source — e.g. a Whisper transcript of a
 * recording, or OCR text from a PDF.
 *
 * One row per (source_id, extraction_type). v1 only writes
 * extraction_type='WHISPER_TRANSCRIBE_TRANSLATE' rows. Transcript files
 * themselves live on S3; this row holds the URLs plus the language
 * metadata we want indexed.
 *
 * jobId is the render-worker job identifier — the callback handler uses it
 * as the idempotency key.
 */
@Entity
@Table(name = "ai_content_extraction")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiContentExtraction {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "source_id", nullable = false)
    private String sourceId;

    /** v1: 'WHISPER_TRANSCRIBE_TRANSLATE'. */
    @Column(name = "extraction_type", nullable = false, length = 64)
    private String extractionType;

    /** QUEUED | RUNNING | COMPLETED | FAILED */
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    /** Render-worker job id — idempotency key for callbacks. */
    @Column(name = "job_id")
    private String jobId;

    /** ISO code: 'hi', 'en', 'ta', etc. Populated when status=COMPLETED. */
    @Column(name = "detected_language", length = 16)
    private String detectedLanguage;

    @Column(name = "language_probability")
    private Double languageProbability;

    @Column(name = "duration_seconds")
    private Double durationSeconds;

    @Column(name = "segment_count")
    private Integer segmentCount;

    @Column(name = "word_count")
    private Integer wordCount;

    /** S3 URL: plain-text transcript in the detected source language. */
    @Column(name = "source_text_url", columnDefinition = "TEXT")
    private String sourceTextUrl;

    /** S3 URL: plain-text English transcript — fed to the LLM during assessment generation. */
    @Column(name = "english_text_url", columnDefinition = "TEXT")
    private String englishTextUrl;

    /**
     * Cached copy of the English transcript body, populated by the
     * Whisper callback when the job finishes. Downstream consumers
     * (e.g. assessment generation) should read this first and only
     * fall back to fetching englishTextUrl from S3 when null
     * (rows transcribed before this column existed).
     */
    @Column(name = "english_text_content", columnDefinition = "TEXT")
    private String englishTextContent;

    /**
     * JSON serialised as TEXT — { source: {...urls}, english: {...urls} } where
     * each sub-map carries json_url, srt_url, vtt_url, txt_url. Service code
     * builds/parses with ObjectMapper.
     */
    @Column(name = "format_urls_json", columnDefinition = "TEXT")
    private String formatUrlsJson;

    /** JSON serialised as TEXT — worker version, whisper model size, task, params. */
    @Column(name = "metadata_json", columnDefinition = "TEXT")
    private String metadataJson;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
