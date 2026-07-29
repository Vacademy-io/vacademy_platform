package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.sql.Timestamp;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface SlideDetailWithOperationProjection {
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

    String getVideoDescription();

    Integer getSlideOrder();

    String getPercentageDocumentWatched();

    String getDocumentLastPage();

    Timestamp getDocumentLastUpdated();

    String getPercentageVideoWatched();

    String getVideoLastTimestamp();

    Timestamp getVideoLastUpdated();

    String getDripConditionJson();

    String getPublishedUrl();

    String getPublishedData();

    String getVideoSourceType();

    // Unified slide completion percentage for this learner, across every slide
    // type (video / document / quiz / question / assignment / assessment / scorm /
    // audio). Uses the same completion operations the chapter rollup does, so a
    // slide's number is consistent with the chapter percentage it contributes to.
    // Lets the side-view Progress tab show a real percentage on every slide row
    // instead of only video / document.
    Double getPercentageCompleted();
}
