package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface SlideDetailProjection {
    String getSlideId();

    String getSlideTitle();

    String getSlideDescription();

    String getSourceType();

    String getStatus();

    String imageFileId();

    String getDocumentId();

    String getDocumentTitle();

    String getDocumentCoverFileId();

    String getDocumentType();

    String getDocumentData();

    String getVideoId();

    String getVideoTitle();

    String getVideoUrl();

    String getVideoDescription();

}
