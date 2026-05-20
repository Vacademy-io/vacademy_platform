package vacademy.io.admin_core_service.features.user_subscription.dto.markdown;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ResetMarkdownRequestDTO {
    private String instituteId;
    private List<String> packageSessionIds;
}
