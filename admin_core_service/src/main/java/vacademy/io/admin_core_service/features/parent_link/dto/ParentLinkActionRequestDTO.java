package vacademy.io.admin_core_service.features.parent_link.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One guardian-link action fired from the assignment-time UI (bulk-assign /
 * add-learner dialog), or a standalone side-view action.
 *
 * <p>{@code direction} tells us which side of the pair {@code anchorUserId}
 * already is:
 * <ul>
 *   <li>{@code PARENT_ADDS_STUDENT} — anchorUserId is the guardian; we
 *       create/link the student under them.</li>
 *   <li>{@code STUDENT_ADDS_PARENT} — anchorUserId is the student; we
 *       create/link a guardian for them.</li>
 * </ul>
 *
 * <p>{@code mode} is {@code CREATE_NEW} (uniqueness-checked, blocks on a
 * duplicate email/mobile) or {@code LINK_EXISTING} (existingUserId points at
 * an already-existing user — no uniqueness check needed).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ParentLinkActionRequestDTO {
    private String instituteId;
    private String direction;
    private String mode;
    private String anchorUserId;
    private String existingUserId;
    private String newFullName;
    private String newEmail;
    private String newMobileNumber;
}
