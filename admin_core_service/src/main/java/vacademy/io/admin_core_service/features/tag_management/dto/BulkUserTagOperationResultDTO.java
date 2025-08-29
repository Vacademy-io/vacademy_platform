package vacademy.io.admin_core_service.features.tag_management.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BulkUserTagOperationResultDTO {
    private int totalProcessed;
    private int successCount;
    private int skipCount; // For already existing tags
    private int errorCount;
    private List<String> errors;
    private Map<String, String> userErrors; // userId -> error message
    
    public BulkUserTagOperationResultDTO(int totalProcessed, int successCount, int skipCount, int errorCount) {
        this.totalProcessed = totalProcessed;
        this.successCount = successCount;
        this.skipCount = skipCount;
        this.errorCount = errorCount;
    }
}
