package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/**
 * DTO for adding/updating audio slides via the simplified API.
 * Wraps slide metadata with audio slide details.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AddAudioSlideDTO {

    /**
     * Slide ID (for updates, null for new slides)
     */
    private String id;

    /**
     * Slide title
     */
    private String title;

    /**
     * Slide cover image file ID
     */
    private String imageFileId;

    /**
     * Slide description
     */
    private String description;

    /**
     * Order of slide within chapter
     */
    private Integer slideOrder;

    /**
     * Audio slide specific data
     */
    private AudioSlideDTO audioSlide;

    /**
     * Status: DRAFT, PUBLISHED, etc.
     */
    private String status;

    /**
     * Whether this is a new slide
     */
    private boolean newSlide;

    /**
     * Whether to notify learners on publish
     */
    private boolean notify;
}
