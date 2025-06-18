package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;


public interface SlideTypeCountProjection {
    String getSourceType();
    Long getSlideCount();
}
