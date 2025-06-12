package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.institute.entity.PackageEntity;


@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LearnerPackageDetailDTO {
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
    private double percentageCompleted;
    private double rating;
    private String packageSessionId;
    private String levelId;
    private String levelName;

    public LearnerPackageDetailDTO(
            String id,
            String packageName,
            String thumbnailFileId,
            Boolean isCoursePublishedToCatalaouge,
            String coursePreviewImageMediaId,
            String courseBannerMediaId,
            String courseMediaId,
            String whyLearnHtml,
            String whoShouldLearnHtml,
            String aboutTheCourseHtml,
            String commaSeparetedTags,
            Integer courseDepth,
            String courseHtmlDescriptionHtml,
            double percentageCompleted,
            double rating,
            String packageSessionId,
            String levelId,
            String levelName
    ) {
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
        this.levelId = levelId;
        this.levelName = levelName;
    }

}
