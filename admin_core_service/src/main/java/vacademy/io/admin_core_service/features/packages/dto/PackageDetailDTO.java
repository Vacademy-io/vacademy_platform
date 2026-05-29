package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Date;
import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@NoArgsConstructor
@Data
public class PackageDetailDTO {
    private String id;
    private String packageName;
    private String thumbnailFileId;
    private Boolean isCoursePublishedToCatalaouge;
    private String coursePreviewImageMediaId;
    private String courseBannerMediaId;
    private String courseMediaId;
    private String whyLearnHtml;
    private String whoShouldLearnHtml;
    private String aboutTheCourseHtml;
    private String commaSeparetedTags;
    private Integer courseDepth;
    private String courseHtmlDescriptionHtml;
    private Double percentageCompleted;
    private Double rating;
    private String packageSessionId;
    private String packageSessionName;
    private String levelId;
    private String levelName;
    private String dripConditionJson;
    private List<UserDTO> instructors;
    private List<String> levelIds;
    private Long readTimeInMinutes;
    private String packageType;
    private Integer validityInDays;
    private String sessionId;
    private String sessionName;
    private Long enrolledStudentCount;
    /**
     * The viewing learner's enrollment status (ACTIVE/INACTIVE/TERMINATED) for this
     * package_session. Populated only on per-user endpoints (e.g. /search-by-user-id);
     * null on catalogue and other listing endpoints where no specific learner is in scope.
     */
    private String enrollmentStatus;
    /** ssigm.enrolled_date — when the learner was first enrolled in this batch. */
    private Date enrolledDate;
    /** ssigm.expiry_date — when the learner's access to this batch ends. */
    private Date expiryDate;
    /**
     * ssigm.updated_at — best-available proxy for "when the status was last changed".
     * Use to display "Inactive since &lt;date&gt;" on deactivated course cards.
     * Caveat: this changes on ANY ssigm field update, not only status flips.
     */
    private Date enrollmentStatusUpdatedAt;

    public PackageDetailDTO(String id, String packageName, String thumbnailFileId, Boolean isCoursePublishedToCatalaouge, String coursePreviewImageMediaId, String courseBannerMediaId, String courseMediaId, String whyLearnHtml, String whoShouldLearnHtml, String aboutTheCourseHtml, String commaSeparetedTags, Integer courseDepth, String courseHtmlDescriptionHtml, Double percentageCompleted, Double rating, String packageSessionId, String packageSessionName, String levelId, String levelName, String dripConditionJson, List<UserDTO> instructors, List<String> levelIds, Long readTimeInMinutes, String packageType, String sessionId, String sessionName, Long enrolledStudentCount) {
        this.id = id;
        this.packageName = packageName;
        this.thumbnailFileId = thumbnailFileId;
        this.isCoursePublishedToCatalaouge = isCoursePublishedToCatalaouge;
        this.coursePreviewImageMediaId = coursePreviewImageMediaId;
        this.courseBannerMediaId = courseBannerMediaId;
        this.courseMediaId = courseMediaId;
        this.whyLearnHtml = whyLearnHtml;
        this.whoShouldLearnHtml = whoShouldLearnHtml;
        this.aboutTheCourseHtml = aboutTheCourseHtml;
        this.commaSeparetedTags = commaSeparetedTags;
        this.courseDepth = courseDepth;
        this.courseHtmlDescriptionHtml = courseHtmlDescriptionHtml;
        this.percentageCompleted = percentageCompleted;
        this.rating = rating;
        this.packageSessionId = packageSessionId;
        this.packageSessionName = packageSessionName;
        this.levelId = levelId;
        this.levelName = levelName;
        this.dripConditionJson = dripConditionJson;
        this.instructors = instructors;
        this.levelIds = levelIds;
        this.readTimeInMinutes = readTimeInMinutes;
        this.packageType = packageType;
        this.sessionId = sessionId;
        this.sessionName = sessionName;
        this.enrolledStudentCount = enrolledStudentCount;
    }
}
