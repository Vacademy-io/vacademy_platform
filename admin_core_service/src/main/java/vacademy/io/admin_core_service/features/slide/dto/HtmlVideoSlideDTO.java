package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class HtmlVideoSlideDTO {
    private String id;
    private String aiGenVideoId;
    private String url;
    private Long videoLengthInMillis;
}
