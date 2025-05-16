package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface LearnerRecentSlides {
    String getSlideId();

    String getSlideTitle();

    String getSlideDescription();

    String getSourceType();

    String getStatus();

    String getImageFileId();

    Long getProgressMarker();

    String getPackageId();

    String getLevelId();

    String getSubjectId();

    String getChapterId();

    String getModuleId();
}
