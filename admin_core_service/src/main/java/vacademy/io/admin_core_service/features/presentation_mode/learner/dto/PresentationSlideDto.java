package vacademy.io.admin_core_service.features.presentation_mode.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class PresentationSlideDto {
    private String type;
    private Object slideData;
    private String slideId;
    private Integer index;
    private String name;
    private Integer slideMaxTimeInSeconds;
    private String studentViewNotes;
    private Boolean isLoaded;
    private Integer autoNextTimeInSeconds;
    private Boolean isAcceptingResponses;
}