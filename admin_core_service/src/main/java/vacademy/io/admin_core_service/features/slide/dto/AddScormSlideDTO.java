package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class AddScormSlideDTO {
    private String title;
    private String imageFileId;
    private String description;
    private Integer slideOrder;
    private ScormSlideDTO scormSlide;
    private String status;
    private boolean newSlide;
    private String id;
    private boolean notify;
}
