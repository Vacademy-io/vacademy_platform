package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Result for individual user import
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserImportResultDTO {

    @JsonProperty("index")
    private int index;

    @JsonProperty("email")
    private String email;

    @JsonProperty("status")
    private ImportStatus status;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("student_id")
    private String studentId;

    @JsonProperty("is_new_user")
    private Boolean isNewUser;

    @JsonProperty("is_new_student")
    private Boolean isNewStudent;

    @JsonProperty("custom_fields_saved")
    private Integer customFieldsSaved;

    @JsonProperty("tags_assigned")
    private Integer tagsAssigned;

    @JsonProperty("payment_gateway_linked")
    private Boolean paymentGatewayLinked;

    @JsonProperty("external_id")
    private String externalId;

    @JsonProperty("error_message")
    private String errorMessage;

    // Factory methods
    public static UserImportResultDTO success(int index, String email, String userId,
            String studentId, boolean isNewUser, boolean isNewStudent,
            int customFieldsSaved, int tagsAssigned, boolean paymentGatewayLinked, String externalId) {
        return UserImportResultDTO.builder()
                .index(index)
                .email(email)
                .status(ImportStatus.SUCCESS)
                .userId(userId)
                .studentId(studentId)
                .isNewUser(isNewUser)
                .isNewStudent(isNewStudent)
                .customFieldsSaved(customFieldsSaved)
                .tagsAssigned(tagsAssigned)
                .paymentGatewayLinked(paymentGatewayLinked)
                .externalId(externalId)
                .build();
    }

    public static UserImportResultDTO failed(int index, String email, String errorMessage) {
        return UserImportResultDTO.builder()
                .index(index)
                .email(email)
                .status(ImportStatus.FAILED)
                .errorMessage(errorMessage)
                .build();
    }

    public static UserImportResultDTO skipped(int index, String email, String userId, String reason) {
        return UserImportResultDTO.builder()
                .index(index)
                .email(email)
                .status(ImportStatus.SKIPPED)
                .userId(userId)
                .errorMessage(reason)
                .build();
    }

    public static UserImportResultDTO validated(int index, String email, String externalId) {
        return UserImportResultDTO.builder()
                .index(index)
                .email(email)
                .status(ImportStatus.VALIDATED)
                .externalId(externalId)
                .build();
    }
}
