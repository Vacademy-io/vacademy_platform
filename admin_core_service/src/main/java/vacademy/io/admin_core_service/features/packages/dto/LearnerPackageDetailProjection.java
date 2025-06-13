package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface LearnerPackageDetailProjection {
    String getId();
    String getPackageName();
    String getThumbnailFileId();
    Boolean getIsCoursePublishedToCatalaouge();
    String getCoursePreviewImageMediaId();
    String getCourseBannerMediaId();
    String getCourseMediaId();
    String getWhyLearnHtml();
    String getWhoShouldLearnHtml();
    String getAboutTheCourseHtml();
    String getCommaSeparetedTags();
    Integer getCourseDepth();
    String getCourseHtmlDescriptionHtml();
    Double getPercentageCompleted();
    Double getRating();
    String getPackageSessionId();
    String getLevelId();
    String getLevelName();
}
