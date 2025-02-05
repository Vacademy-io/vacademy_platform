package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Getter
@Setter
public class AddDocumentSlideDTO {
    private String id;
    private String title;
    private String imageFileId;
    private String description;
    private Integer slideOrder;
    private DocumentSlideDTO documentSlide;
    private String status;
    private boolean newSlide;
}
