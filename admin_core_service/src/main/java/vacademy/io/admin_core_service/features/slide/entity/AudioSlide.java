package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.admin_core_service.features.slide.dto.AudioSlideDTO;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;

import java.sql.Timestamp;

/**
 * Entity representing an audio slide.
 * Stores audio file reference and metadata for audio-based learning content.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "audio_slide")
public class AudioSlide {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * File ID of the audio file stored in the file service
     */
    @Column(name = "audio_file_id", length = 255)
    private String audioFileId;

    /**
     * Optional thumbnail/cover image file ID
     */
    @Column(name = "thumbnail_file_id", length = 255)
    private String thumbnailFileId;

    /**
     * Duration of the audio in milliseconds
     */
    @Column(name = "audio_length_in_millis")
    private Long audioLengthInMillis;

    /**
     * Published audio file ID (after publish, this is the active file)
     */
    @Column(name = "published_audio_file_id", length = 255)
    private String publishedAudioFileId;

    /**
     * Published audio length in milliseconds
     */
    @Column(name = "published_audio_length_in_millis")
    private Long publishedAudioLengthInMillis;

    /**
     * Audio source type: FILE, URL, or external service
     */
    @Column(name = "source_type", length = 50)
    private String sourceType;

    /**
     * External URL if audio is hosted externally
     */
    @Column(name = "external_url", length = 500)
    private String externalUrl;

    /**
     * Transcript of the audio content (optional, for accessibility)
     */
    @Column(name = "transcript", columnDefinition = "TEXT")
    private String transcript;

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp updatedAt;

    /**
     * Constructor from DTO
     */
    public AudioSlide(AudioSlideDTO dto, String status) {
        this.id = dto.getId();
        this.title = dto.getTitle();
        this.description = dto.getDescription();
        this.audioFileId = dto.getAudioFileId();
        this.thumbnailFileId = dto.getThumbnailFileId();
        this.audioLengthInMillis = dto.getAudioLengthInMillis();
        this.sourceType = dto.getSourceType();
        this.externalUrl = dto.getExternalUrl();
        this.transcript = dto.getTranscript();

        // Set published values if status is PUBLISHED
        if (status != null && status.equalsIgnoreCase(SlideStatus.PUBLISHED.name())) {
            this.publishedAudioFileId = dto.getPublishedAudioFileId() != null
                    ? dto.getPublishedAudioFileId()
                    : dto.getAudioFileId();
            this.publishedAudioLengthInMillis = dto.getPublishedAudioLengthInMillis() != null
                    ? dto.getPublishedAudioLengthInMillis()
                    : dto.getAudioLengthInMillis();
        }
    }

    /**
     * Update fields from DTO
     */
    public void updateFromDTO(AudioSlideDTO dto, String status) {
        if (dto.getTitle() != null)
            this.title = dto.getTitle();
        if (dto.getDescription() != null)
            this.description = dto.getDescription();
        if (dto.getAudioFileId() != null)
            this.audioFileId = dto.getAudioFileId();
        if (dto.getThumbnailFileId() != null)
            this.thumbnailFileId = dto.getThumbnailFileId();
        if (dto.getAudioLengthInMillis() != null)
            this.audioLengthInMillis = dto.getAudioLengthInMillis();
        if (dto.getSourceType() != null)
            this.sourceType = dto.getSourceType();
        if (dto.getExternalUrl() != null)
            this.externalUrl = dto.getExternalUrl();
        if (dto.getTranscript() != null)
            this.transcript = dto.getTranscript();

        // Update published values if status is PUBLISHED
        if (status != null && status.equalsIgnoreCase(SlideStatus.PUBLISHED.name())) {
            this.publishedAudioFileId = dto.getPublishedAudioFileId() != null
                    ? dto.getPublishedAudioFileId()
                    : this.audioFileId;
            this.publishedAudioLengthInMillis = dto.getPublishedAudioLengthInMillis() != null
                    ? dto.getPublishedAudioLengthInMillis()
                    : this.audioLengthInMillis;
        }
    }

    /**
     * Convert to DTO
     */
    public AudioSlideDTO toDTO() {
        AudioSlideDTO dto = new AudioSlideDTO();
        dto.setId(this.id);
        dto.setTitle(this.title);
        dto.setDescription(this.description);
        dto.setAudioFileId(this.audioFileId);
        dto.setThumbnailFileId(this.thumbnailFileId);
        dto.setAudioLengthInMillis(this.audioLengthInMillis);
        dto.setPublishedAudioFileId(this.publishedAudioFileId);
        dto.setPublishedAudioLengthInMillis(this.publishedAudioLengthInMillis);
        dto.setSourceType(this.sourceType);
        dto.setExternalUrl(this.externalUrl);
        dto.setTranscript(this.transcript);
        return dto;
    }
}
