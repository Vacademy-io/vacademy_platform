package vacademy.io.common.institute.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.institute.entity.PackageEntity;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

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
    private List<String> tags;
    private Integer courseDepth;
    private String courseHtmlDescriptionHtml;
    private String dripConditionJson;

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
        if (packageEntity.getTags() != null && !packageEntity.getTags().isEmpty()) {
            this.tags = Arrays.stream(packageEntity.getTags().split(","))
                    .map(String::trim)
                    .collect(Collectors.toList());
        } else {
            this.tags = Collections.emptyList();
        }
        this.courseDepth = packageEntity.getCourseDepth();
        this.courseHtmlDescriptionHtml = packageEntity.getCourseHtmlDescription();
        this.dripConditionJson = packageEntity.getDripConditionJson();
    }
}