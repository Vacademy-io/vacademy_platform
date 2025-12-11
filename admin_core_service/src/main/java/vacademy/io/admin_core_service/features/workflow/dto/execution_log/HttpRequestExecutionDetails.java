package vacademy.io.admin_core_service.features.workflow.dto.execution_log;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * Execution details for HTTP_REQUEST node.
 * Captures request/response details and errors.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class HttpRequestExecutionDetails extends BaseNodeExecutionDetails {

    private String method;
    private String url;
    private Integer statusCode;
    private String responseBody;

    private Boolean conditionEvaluated;
    private Boolean conditionResult;
    private String resultKey;
    private String errorMessage;
    private String errorType;
}
