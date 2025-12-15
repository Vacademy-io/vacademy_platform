package vacademy.io.admin_core_service.features.workflow.dto.execution_log;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;
import java.util.Map;

/**
 * Execution details for SEND_EMAIL node.
 * Tracks email sending operations and failures.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EmailExecutionDetails extends BaseNodeExecutionDetails {

    private String collectionExpression;
    private Integer totalEmails;
    private Integer skippedCount;
    private List<FailedEmail> failedEmails;
    private Map<String, Object> summary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FailedEmail {
        private Integer index;
        private String recipientEmail;
        private String templateName;
        private Map<String, Object> templateVars;
        private Object itemData;
        private String errorMessage;
        private String errorType;
        private String failureReason;
    }
}
