package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class DocumentSlideDTO {
    private String id;
    private String type;
    private String data;
    private String title;
    private String coverFileId;
    private Integer totalPages;
    private String publishedData;
    private Integer publishedDocumentTotalPages;

    /**
     * When true, bypasses the publish-time shrink guard so an author can intentionally
     * replace a large published document with a much smaller one (confirmed in the UI).
     */
    private boolean forcePublish;

    /**
     * When true, bypasses the draft/unsync structural-block loss guard so an author can
     * intentionally remove a table/image/video/custom block (confirmed in the UI). The
     * draft-save equivalent of {@link #forcePublish}.
     */
    private boolean forceOverwrite;
}
