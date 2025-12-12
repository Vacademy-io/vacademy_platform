package vacademy.io.admin_core_service.features.workflow.dto.execution_log;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.Map;

/**
 * Base class for node execution details.
 * Contains common fields for all node types.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BaseNodeExecutionDetails {

    /**
     * Input context/data that was passed to the node.
     */
    private Map<String, Object> inputContext;

    /**
     * Output context/data produced by the node.
     */
    private Map<String, Object> outputContext;

    /**
     * Configuration used for this node execution.
     */
    private Map<String, Object> nodeConfig;

    /**
     * Total number of items processed (for batch operations).
     */
    private Integer totalItems;

    /**
     * Number of successfully processed items.
     */
    private Integer successCount;

    /**
     * Number of failed items.
     */
    private Integer failureCount;

    /**
     * Additional metadata specific to the node type.
     */
    /**
     * Additional metadata specific to the node type.
     */
    private Map<String, Object> metadata;

    /**
     * Execution duration in milliseconds.
     */
    private Long executionTimeMs;
}
