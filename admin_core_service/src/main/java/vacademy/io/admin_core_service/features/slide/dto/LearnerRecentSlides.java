package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.sql.Timestamp;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface LearnerRecentSlides {
    String getSlideId();
    String getSlideTitle();
    String getSlideDescription();
    String getSourceType();
    String getStatus();
    String getImageFileId();
    String getDocumentId();
    String getDocumentTitle();
    String getDocumentCoverFileId();
    String getDocumentType();
    String getDocumentData();
    String getVideoId();
    String getVideoTitle();
    String getVideoUrl();
    String getVideoSourceType();
    String getVideoDescription();
    Integer getSlideOrder(); // Added slide order field
    String getPublishedUrl();
    String getPublishedData();
    Long getVideoLastTimeStamp();
    Long getDocumentLastPage();
    String getPackageId();
    String getLevelId();
    String getSubjectId();
    String getChapterId();
    String getModuleId();
}
