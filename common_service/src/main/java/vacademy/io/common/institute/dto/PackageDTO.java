package vacademy.io.common.institute.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.institute.entity.PackageEntity;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PackageDTO {
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

    // Constructor from Package entity
    public PackageDTO(PackageEntity packageEntity) {
        this.id = packageEntity.getId();
        this.packageName = packageEntity.getPackageName();
        this.thumbnailFileId = packageEntity.getThumbnailFileId();
        this.isCoursePublishedToCatalaouge = packageEntity.getIsCoursePublishedToCatalaouge();
        this.coursePreviewImageMediaId = packageEntity.getCoursePreviewImageMediaId();
        this.courseBannerMediaId = packageEntity.getCourseBannerMediaId();
        this.courseMediaId = packageEntity.getCourseMediaId();
        this.whyLearnHtml = packageEntity.getWhyLearn();
        this.whoShouldLearnHtml = packageEntity.getWhoShouldLearn();
        this.aboutTheCourseHtml = packageEntity.getAboutTheCourse();
    }
}