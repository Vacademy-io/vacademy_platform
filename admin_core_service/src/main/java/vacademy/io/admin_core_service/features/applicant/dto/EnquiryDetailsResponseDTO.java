package vacademy.io.admin_core_service.features.applicant.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * Response DTO for GET /v1/enquiry/details API
 * Contains pre-fill data for application form
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class EnquiryDetailsResponseDTO {

    private String enquiryId;
    private String trackingId;
    private Boolean alreadyApplied;
    private String applicantId;

    private ParentDetails parent;
    private ChildDetails child;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ParentDetails {
        private String id;
        private String name;
        private String phone;
        private String email;
        private String addressLine;
        private String city;
        private String pinCode;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ChildDetails {
        private String id;
        private String name;
        private Date dob;
        private String gender;
    }
}
