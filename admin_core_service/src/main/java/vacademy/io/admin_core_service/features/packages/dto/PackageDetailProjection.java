package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface PackageDetailProjection {
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
    List<String> getFacultyUserIds();
    List<String>getLevelIds();
    Long getReadTimeInMinutes();
    String getPackageType();
}
