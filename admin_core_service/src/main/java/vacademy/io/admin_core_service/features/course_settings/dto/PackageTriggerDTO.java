package vacademy.io.admin_core_service.features.course_settings.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One workflow trigger attached to a course: a workflow that fires on a given trigger event when
 * the event happens for the course (stored as workflow_trigger rows with event_id = each of the
 * package's package sessions). {@code workflowName} is populated on read; ignored on save.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PackageTriggerDTO {
    private String triggerEventName;
    private String workflowId;
    private String workflowName;
}
