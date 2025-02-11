package vacademy.io.admin_core_service.features.chapter.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface ChapterDetailsProjection {
    String getId();
    String getChapterName();
    String getStatus();
    String getFileId();
    String getDescription();
    Double getPercentageCompleted();
    String getLastSlideViewed();
    Integer getVideoCount();
    Integer getPdfCount();
    Integer getDocCount();
    Integer getUnknownCount();
}
