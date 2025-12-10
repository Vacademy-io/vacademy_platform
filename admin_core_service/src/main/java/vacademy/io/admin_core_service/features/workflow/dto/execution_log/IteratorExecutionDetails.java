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
 * Execution details for ITERATOR operations within ACTION nodes.
 * Tracks item-level processing and failures.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class IteratorExecutionDetails extends BaseNodeExecutionDetails {

    private String collectionExpression;
    private String operation;
    private List<FailedItem> failedItems;
    private Map<String, Object> summary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FailedItem {
        private Integer index;
        private Object itemData;
        private String errorMessage;
        private String errorType;
        private Map<String, Object> contextAtFailure;
        private String failedOperation;
    }
}
