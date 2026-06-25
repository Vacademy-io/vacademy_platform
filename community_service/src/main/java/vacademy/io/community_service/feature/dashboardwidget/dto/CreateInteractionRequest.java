package vacademy.io.community_service.feature.dashboardwidget.dto;

import lombok.Data;

/**
 * Institute-side request to comment on / confirm a widget. Used by both
 * {@code POST /{id}/comment} (message required) and {@code POST /{id}/milestones/{mid}/confirm}
 * (milestoneId from the path, message optional). Actor identity is taken from the principal.
 */
@Data
public class CreateInteractionRequest {
    private String message;
    private String milestoneId;   // optional for comments; set from the path for confirmations
}
