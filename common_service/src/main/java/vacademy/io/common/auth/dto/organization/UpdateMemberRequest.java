package vacademy.io.common.auth.dto.organization;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/**
 * Update an existing membership row. Drag-and-drop in the UI calls this
 * with a new {@code parent_user_id} to change who the person reports to
 * inside the team. {@code role_label} can also be edited inline.
 *
 * All three fields are independently nullable in the sense of "not present
 * in the payload" — the service only writes a field if the caller sent it.
 * Use {@link #isChangeParent()} / {@link #isChangeRoleLabel()} to signal
 * intent, since a literal null value is a meaningful state (NULL parent =
 * top of team; empty role_label = clear the title).
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UpdateMemberRequest {
    /** Set this to true to apply parentUserId (incl. NULL "make top of team"). */
    private Boolean changeParent;
    private String parentUserId;

    /** Set this to true to apply roleLabel (incl. empty "clear the title"). */
    private Boolean changeRoleLabel;
    private String roleLabel;
}
