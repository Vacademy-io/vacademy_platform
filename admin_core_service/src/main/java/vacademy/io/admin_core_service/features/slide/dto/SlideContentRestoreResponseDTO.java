package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

/**
 * Result of restoring a history snapshot into a slide's draft columns. The
 * restored value is echoed back so the editor can reload the content without
 * refetching the whole chapter's slides.
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SlideContentRestoreResponseDTO {
    private String restoredValue;
    private String slideStatus;
}
