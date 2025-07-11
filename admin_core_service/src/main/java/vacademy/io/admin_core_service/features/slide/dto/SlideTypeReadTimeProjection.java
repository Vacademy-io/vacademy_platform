package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;


@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface SlideTypeReadTimeProjection {
    String getSourceType();
    Long getSlideCount();
    Double getTotalReadTimeMinutes();
}
