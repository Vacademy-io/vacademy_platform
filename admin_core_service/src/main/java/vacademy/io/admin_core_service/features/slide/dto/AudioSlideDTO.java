package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/**
 * DTO for AudioSlide data transfer.
 * Used for creating and updating audio slides.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AudioSlideDTO {

    private String id;

    private String title;

    private String description;

    /**
     * File ID of the audio file stored in file service
     */
    private String audioFileId;

    /**
     * Optional thumbnail/cover image file ID
     */
    private String thumbnailFileId;

    /**
     * Duration of audio in milliseconds
     */
    private Long audioLengthInMillis;

    /**
     * Published audio file ID
     */
    private String publishedAudioFileId;

    /**
     * Published audio length in milliseconds
     */
    private Long publishedAudioLengthInMillis;

    /**
     * Source type: FILE, URL, EXTERNAL
     */
    private String sourceType;

    /**
     * External URL if audio is hosted externally
     */
    private String externalUrl;

    /**
     * Transcript of the audio content
     */
    private String transcript;
}
