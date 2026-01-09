package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@AllArgsConstructor
@NoArgsConstructor
@Data
public class PackageDetailV2DTO {
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
    private String levelId;
    private String levelName;
    private String dripConditionJson;
    private List<UserDTO> instructors;
    private Long readTimeInMinutes;
    private String packageType;

    // Enroll Invite + Payment details
    private String enrollInviteId;
    private String paymentOptionId;
    private String paymentOptionType;
    private String paymentOptionStatus;
    private Double minPlanActualPrice;
    private String currency;
    private Integer availableSlots;
}
