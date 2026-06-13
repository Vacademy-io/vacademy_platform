package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Partial-update payload for a single node template, used by the in-place "Configuration" editor
 * (PUT /workflow/{workflowId}/node-template/{nodeTemplateId}). Every field is optional — only
 * non-null fields are applied, so the frontend can patch just {@code config_json} or just the
 * start/end flags. {@code config_json} is validated to be a JSON object before it is persisted.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class NodeTemplateUpdateDTO {

    /** Raw config JSON (must parse to a JSON object). When null, the existing config is kept. */
    @JsonProperty("config_json")
    private String configJson;

    @JsonProperty("node_name")
    private String nodeName;

    /** Must be a valid {@link vacademy.io.admin_core_service.features.workflow.enums.NodeType} when provided. */
    @JsonProperty("node_type")
    private String nodeType;

    @JsonProperty("status")
    private String status;

    /** Raw retry config JSON (must parse to a JSON object when non-blank). */
    @JsonProperty("retry_config")
    private String retryConfig;

    @JsonProperty("is_start_node")
    private Boolean isStartNode;

    @JsonProperty("is_end_node")
    private Boolean isEndNode;
}
