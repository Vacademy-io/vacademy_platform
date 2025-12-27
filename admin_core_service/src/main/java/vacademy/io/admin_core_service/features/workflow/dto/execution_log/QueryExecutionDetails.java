package vacademy.io.admin_core_service.features.workflow.dto.execution_log;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.Map;

/**
 * Execution details for QUERY node.
 * Captures query execution and results.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class QueryExecutionDetails extends BaseNodeExecutionDetails {

    private String prebuiltKey;
    private String query;
    private Map<String, Object> params;
    private String resultKey;
    private Integer rowsReturned;

    private String errorMessage;
    private String errorType;
}
