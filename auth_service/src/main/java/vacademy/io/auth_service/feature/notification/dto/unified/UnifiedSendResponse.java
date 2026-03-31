package vacademy.io.auth_service.feature.notification.dto.unified;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class UnifiedSendResponse {
    private String batchId;
    private int total;
    private int accepted;
    private int failed;
    private String status;
    private List<RecipientResult> results;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RecipientResult {
        private String phone;
        private String email;
        private boolean success;
        private String status;
        private String error;
    }
}
