package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AddVideoSlideDTO {
    private String title;
    private String imageFileId;
    private String description;
    private Integer slideOrder;
    private VideoSlideDTO videoSlide;
    private String status;
    private boolean newSlide;
    private String id;
}
