package vacademy.io.admin_core_service.features.presentation_mode.admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class CreatePresentationDto {
    private String source;
    private String sourceId;
}