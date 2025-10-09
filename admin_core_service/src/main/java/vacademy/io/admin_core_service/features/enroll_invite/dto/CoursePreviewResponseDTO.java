package vacademy.io.admin_core_service.features.enroll_invite.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class CoursePreviewResponseDTO {

    @JsonProperty("course")
    private String course;

    @JsonProperty("description")
    private String description;

    @JsonProperty("learningOutcome")
    private String learningOutcome;

    @JsonProperty("aboutCourse")
    private String aboutCourse;

    @JsonProperty("targetAudience")
    private String targetAudience;

    @JsonProperty("coursePreview")
    private String coursePreview;

    @JsonProperty("courseBanner")
    private String courseBanner;

    @JsonProperty("courseMedia")
    private CourseMediaDTO courseMedia;

    @JsonProperty("coursePreviewBlob")
    private String coursePreviewBlob;

    @JsonProperty("courseBannerBlob")
    private String courseBannerBlob;

    @JsonProperty("courseMediaBlob")
    private String courseMediaBlob;

    @JsonProperty("tags")
    private List<String> tags;

    @JsonProperty("showRelatedCourses")
    private Boolean showRelatedCourses;

    @JsonProperty("includeInstituteLogo")
    private Boolean includeInstituteLogo;

    @JsonProperty("instituteLogoFileId")
    private String instituteLogoFileId;

    @JsonProperty("restrictToSameBatch")
    private Boolean restrictToSameBatch;

    @JsonProperty("includePaymentPlans")
    private Boolean includePaymentPlans;

    @JsonProperty("customHtml")
    private String customHtml;

    @Data
    public static class CourseMediaDTO {
        @JsonProperty("type")
        private String type;

        @JsonProperty("id")
        private String id;
    }
}
