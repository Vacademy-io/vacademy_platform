package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;

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

    public PackageDetailDTO(String id, String packageName, String thumbnailFileId, Boolean isCoursePublishedToCatalaouge, String coursePreviewImageMediaId, String courseBannerMediaId, String courseMediaId, String whyLearnHtml, String whoShouldLearnHtml, String aboutTheCourseHtml, String commaSeparetedTags, Integer courseDepth, String courseHtmlDescriptionHtml, Double percentageCompleted, Double rating, String packageSessionId, String packageSessionName, String levelId, String levelName, String dripConditionJson, List<UserDTO> instructors, List<String> levelIds, Long readTimeInMinutes, String packageType, String sessionId, String sessionName) {
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
    }
}
