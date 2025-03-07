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
}
