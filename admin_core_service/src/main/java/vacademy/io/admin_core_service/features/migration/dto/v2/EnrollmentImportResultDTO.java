package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Result for individual enrollment import
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnrollmentImportResultDTO {

    @JsonProperty("index")
    private int index;

    @JsonProperty("email")
    private String email;

    @JsonProperty("status")
    private ImportStatus status;

    /**
     * Type of enrollment: INDIVIDUAL, PRACTICE_ROOT_ADMIN, PRACTICE_MEMBER
     */
    @JsonProperty("enrollment_type")
    private String enrollmentType;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("user_plan_id")
    private String userPlanId;

    @JsonProperty("ssigm_id")
    private String ssigmId;

    /**
     * SubOrg ID (for practice enrollments)
     */
    @JsonProperty("sub_org_id")
    private String subOrgId;

    /**
     * SubOrg name (for practice enrollments)
     */
    @JsonProperty("sub_org_name")
    private String subOrgName;

    /**
     * Roles in SSIGM
     */
    @JsonProperty("roles")
    private String roles;

    @JsonProperty("payment_logs_created")
    private Integer paymentLogsCreated;

    @JsonProperty("is_new_enrollment")
    private Boolean isNewEnrollment;

    @JsonProperty("external_subscription_id")
    private String externalSubscriptionId;

    @JsonProperty("error_message")
    private String errorMessage;

    // Factory methods
    public static EnrollmentImportResultDTO successIndividual(int index, String email, String userId,
            String userPlanId, String ssigmId, int paymentLogsCreated, String externalSubscriptionId) {
        return EnrollmentImportResultDTO.builder()
                .index(index)
                .email(email)
                .status(ImportStatus.SUCCESS)
                .enrollmentType("INDIVIDUAL")
                .userId(userId)
                .userPlanId(userPlanId)
                .ssigmId(ssigmId)
                .paymentLogsCreated(paymentLogsCreated)
                .isNewEnrollment(true)
                .externalSubscriptionId(externalSubscriptionId)
                .build();
    }

    public static EnrollmentImportResultDTO successPracticeRootAdmin(int index, String email, String userId,
            String userPlanId, String ssigmId, String subOrgId, String subOrgName,
            int paymentLogsCreated, String externalSubscriptionId) {
        return EnrollmentImportResultDTO.builder()
                .index(index)
                .email(email)
                .status(ImportStatus.SUCCESS)
                .enrollmentType("PRACTICE_ROOT_ADMIN")
                .userId(userId)
                .userPlanId(userPlanId)
                .ssigmId(ssigmId)
                .subOrgId(subOrgId)
                .subOrgName(subOrgName)
                .roles("ROOT_ADMIN,LEARNER")
                .paymentLogsCreated(paymentLogsCreated)
                .isNewEnrollment(true)
                .externalSubscriptionId(externalSubscriptionId)
                .build();
    }

    public static EnrollmentImportResultDTO successPracticeMember(int index, String email, String userId,
            String userPlanId, String ssigmId, String subOrgId, String roles) {
        return EnrollmentImportResultDTO.builder()
                .index(index)
                .email(email)
                .status(ImportStatus.SUCCESS)
                .enrollmentType("PRACTICE_MEMBER")
                .userId(userId)
                .userPlanId(userPlanId)
                .ssigmId(ssigmId)
                .subOrgId(subOrgId)
                .roles(roles)
                .isNewEnrollment(true)
                .build();
    }

    public static EnrollmentImportResultDTO failed(int index, String email, String errorMessage) {
        return EnrollmentImportResultDTO.builder()
                .index(index)
                .email(email)
                .status(ImportStatus.FAILED)
                .errorMessage(errorMessage)
                .build();
    }

    public static EnrollmentImportResultDTO skipped(int index, String email, String reason) {
        return EnrollmentImportResultDTO.builder()
                .index(index)
                .email(email)
                .status(ImportStatus.SKIPPED)
                .errorMessage(reason)
                .build();
    }

    public static EnrollmentImportResultDTO validated(int index, String email, String enrollmentType,
            String externalSubscriptionId) {
        return EnrollmentImportResultDTO.builder()
                .index(index)
                .email(email)
                .status(ImportStatus.VALIDATED)
                .enrollmentType(enrollmentType)
                .externalSubscriptionId(externalSubscriptionId)
                .build();
    }
}
