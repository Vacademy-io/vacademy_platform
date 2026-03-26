package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WorkflowBuilderDTO {

    @JsonProperty("id")
    private String id;

    @JsonProperty("name")
    private String name;

    @JsonProperty("description")
    private String description;

    @JsonProperty("status")
    private String status; // DRAFT, ACTIVE, INACTIVE

    @JsonProperty("workflow_type")
    private String workflowType; // SCHEDULED, EVENT_DRIVEN

    @JsonProperty("institute_id")
    private String instituteId;

    @JsonProperty("nodes")
    private List<NodeDTO> nodes;

    @JsonProperty("edges")
    private List<EdgeDTO> edges;

    @JsonProperty("schedule")
    private ScheduleDTO schedule;

    @JsonProperty("trigger")
    private TriggerDTO trigger;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class NodeDTO {
        @JsonProperty("id")
        private String id; // client-generated temp ID or existing DB ID

        @JsonProperty("name")
        private String name;

        @JsonProperty("node_type")
        private String nodeType;

        @JsonProperty("config")
        private Object config; // JSON config, will be serialized to string

        @JsonProperty("position_x")
        private Double positionX;

        @JsonProperty("position_y")
        private Double positionY;

        @JsonProperty("is_start_node")
        private Boolean isStartNode;

        @JsonProperty("is_end_node")
        private Boolean isEndNode;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class EdgeDTO {
        @JsonProperty("id")
        private String id;

        @JsonProperty("source_node_id")
        private String sourceNodeId;

        @JsonProperty("target_node_id")
        private String targetNodeId;

        @JsonProperty("label")
        private String label;

        @JsonProperty("condition")
        private String condition; // SpEL condition for conditional edges
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class ScheduleDTO {
        @JsonProperty("schedule_type")
        private String scheduleType; // CRON, INTERVAL

        @JsonProperty("cron_expression")
        private String cronExpression;

        @JsonProperty("interval_minutes")
        private Integer intervalMinutes;

        @JsonProperty("timezone")
        private String timezone;

        @JsonProperty("start_date")
        private String startDate;

        @JsonProperty("end_date")
        private String endDate;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class TriggerDTO {
        @JsonProperty("trigger_event_name")
        private String triggerEventName;

        @JsonProperty("description")
        private String description;

        @JsonProperty("event_id")
        private String eventId;
    }
}
