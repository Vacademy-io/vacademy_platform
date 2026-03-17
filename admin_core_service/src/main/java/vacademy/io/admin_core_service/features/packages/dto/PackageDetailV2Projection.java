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

    String getDripConditionJson();

    Double getRating();

    Long getReadTimeInMinutes();

    String getPackageType();

    // New v2 fields
    String getPackageSessionId();

    String getLevelId();

    String getLevelName();

    // Faculty IDs (from faculty_subject_package_session_mapping)
    List<String> getFacultyUserIds();

    /** Package creator user id (for instructor fallback when no faculty mapped). */
    String getCreatedByUserId();

    // Enroll Invite + Payment details (default invite -> psli -> last updated payment_option -> its plan)
    String getEnrollInviteId();

    String getPsliId();

    String getPaymentOptionId();

    String getPaymentOptionType();

    String getPaymentOptionStatus();

    String getPaymentPlanId();

    Double getMinPlanActualPrice();

    String getCurrency();

    Integer getAvailableSlots();
}
