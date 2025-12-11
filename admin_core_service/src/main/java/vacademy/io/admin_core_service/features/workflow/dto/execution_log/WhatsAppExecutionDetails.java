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
 * Execution details for SEND_WHATSAPP node.
 * Tracks WhatsApp message sending operations and failures.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WhatsAppExecutionDetails extends BaseNodeExecutionDetails {

    private String collectionExpression;
    private Integer totalMessages;
    private Integer skippedCount;
    private List<FailedMessage> failedMessages;
    private Map<String, Object> summary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FailedMessage {
        private Integer index;
        private String mobileNumber;
        private String templateName;
        private String languageCode;
        private Map<String, Object> templateVars;
        private Object itemData;
        private String errorMessage;
        private String errorType;
        private String failureReason;
    }
}
