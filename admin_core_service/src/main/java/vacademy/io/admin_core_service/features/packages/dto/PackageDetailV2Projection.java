package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface PackageDetailV2Projection {
    // Old fields
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
    Double getRating();
    Long getReadTimeInMinutes();
    String getPackageType();

    // New v2 fields
    String getPackageSessionId();
    String getLevelId();
    String getLevelName();

    // Faculty IDs
    List<String> getFacultyUserIds();

    // Enroll Invite + Payment details
    String getEnrollInviteId();
    String getPaymentOptionId();
    String getPaymentOptionType();
    String getPaymentOptionStatus();
    Double getMinPlanActualPrice();
    String getCurrency();
}
