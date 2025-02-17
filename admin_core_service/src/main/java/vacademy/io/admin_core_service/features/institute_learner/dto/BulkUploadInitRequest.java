package vacademy.io.admin_core_service.features.institute_learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class BulkUploadInitRequest {
    private AutoGenerateConfig autoGenerateConfig;
    private OptionalFieldsConfig optionalFieldsConfig;
    private ExpiryAndStatusConfig expiryAndStatusConfig;

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class AutoGenerateConfig {
        private boolean autoGenerateUsername;
        private boolean autoGeneratePassword;
        private boolean autoGenerateEnrollmentId;
    }

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class OptionalFieldsConfig {
        private boolean includeAddressLine;
        private boolean includeRegion;
        private boolean includeCity;
        private boolean includePinCode;
        private boolean includeFatherName;
        private boolean includeMotherName;
        private boolean includeParentsMobileNumber;
        private boolean includeParentsEmail;
        private boolean includeLinkedInstituteName;
    }

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class ExpiryAndStatusConfig {
        private boolean includeExpiryDays;
        private boolean includeEnrollmentStatus;
        private Integer expiryDays;
        private String enrollmentStatus;
    }
}