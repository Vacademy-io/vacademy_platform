package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Raw, loss-less view of a workflow's nodes for the in-place "Configuration" editor on the
 * workflow detail page. Unlike {@link WorkflowBuilderDTO} (which strips {@code routing} out of
 * each node config and reconstructs edges), this returns each node template's {@code config_json}
 * exactly as stored — routing included — so power users can hand-tune complex workflows without
 * the lossy builder round-trip.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WorkflowRawDTO {

    @JsonProperty("id")
    private String id;

    @JsonProperty("name")
    private String name;

    @JsonProperty("description")
    private String description;

    @JsonProperty("status")
    private String status;

    @JsonProperty("workflow_type")
    private String workflowType;

    @JsonProperty("institute_id")
    private String instituteId;

    @JsonProperty("created_at")
    private String createdAt;

    @JsonProperty("updated_at")
    private String updatedAt;

    @JsonProperty("nodes")
    private List<RawNodeDTO> nodes;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class RawNodeDTO {
        /** workflow_node_mapping.id */
        @JsonProperty("mapping_id")
        private String mappingId;

        /** node_template.id — used as the PUT path variable */
        @JsonProperty("node_template_id")
        private String nodeTemplateId;

        @JsonProperty("node_name")
        private String nodeName;

        @JsonProperty("node_type")
        private String nodeType;

        @JsonProperty("status")
        private String status;

        @JsonProperty("version")
        private Integer version;

        /** Raw config JSON string, exactly as persisted (routing included). */
        @JsonProperty("config_json")
        private String configJson;

        /** Raw retry config JSON string (may be null). */
        @JsonProperty("retry_config")
        private String retryConfig;

        @JsonProperty("node_order")
        private Integer nodeOrder;

        @JsonProperty("is_start_node")
        private Boolean isStartNode;

        @JsonProperty("is_end_node")
        private Boolean isEndNode;
    }
}
