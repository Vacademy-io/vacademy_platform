package vacademy.io.auth_service.feature.notification.dto.unified;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnifiedSendResponse {
    private String batchId;
    private int total;
    private int accepted;
    private int failed;
    private String status;
}
