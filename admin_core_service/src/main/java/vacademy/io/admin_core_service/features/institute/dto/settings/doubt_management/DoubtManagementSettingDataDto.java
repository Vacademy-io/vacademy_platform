package vacademy.io.admin_core_service.features.institute.dto.settings.doubt_management;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload stored inside the institute's DOUBT_MANAGEMENT_SETTING slot. Controls which faculty are
 * auto-assigned to new doubts.
 *
 * {@link #defaultAssigneeSource} values:
 *   <ul>
 *     <li>SUBJECT_TEACHER — only FSPSSM-linked faculty whose subject_id matches the doubt's subject</li>
 *     <li>BATCH_TEACHER  — all FSPSSM-linked faculty for the doubt's batch (current/legacy behavior)</li>
 *     <li>BOTH           — union of the above (effectively same as BATCH_TEACHER in practice)</li>
 *     <li>NONE           — no auto-assign; admin assigns manually</li>
 *   </ul>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class DoubtManagementSettingDataDto {
    /**
     * One of {@link DoubtDefaultAssigneeSourceEnum#name()}. String (not enum) so Jackson tolerates
     * unknown values written by an older/newer frontend without blowing up the whole settings blob.
     */
    private String defaultAssigneeSource;

    /**
     * When {@code defaultAssigneeSource=SUBJECT_TEACHER} and the doubt's subject has no FSPSSM-linked
     * faculty, fall back to batch-level faculty instead of leaving the doubt unassigned.
     */
    private Boolean fallbackToBatchWhenNoSubjectTeacher;
}
